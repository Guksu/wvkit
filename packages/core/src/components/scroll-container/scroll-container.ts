import { WebviewHeadlessError } from '../../errors';
import { createCamera } from './camera';
import { type CameraControl, createCameraControl } from './camera-control';
import { createPanelRenderer } from './panel-renderer';
import type { ScrollContainerInstance, ScrollContainerOptions } from './types';

/**
 * 가로/세로 패널 스크롤 컨테이너 (카메라 모델 + CSS transform 렌더러 + CameraControl).
 *
 * 아키텍처:
 *  - 카메라(`camera.ts`)는 위치 x·y와 zoom만 가진다. 렌더러(`panel-renderer.ts`)가 그 값을
 *    scene 하나의 `translate(...) scale(...)`로 옮긴다 — 의존성 없음 (#4)
 *  - 패널은 scene 안에 절대 배치되고, overscan 기반 가상화로 창 밖 패널은 숨긴다 (#4)
 *  - 입력 처리는 `camera-control.ts`에 위임 (#3) — axis pan, snap, edge resistance, 핀치 줌, RAF 트윈,
 *    줌 상태 pan(패널 가장자리까지 이동, 릴리스 시 위치 유지)
 *  - 본 파일은 CameraControl의 콜백을 받아 active/zoom 상태 갱신 + 가상화 + 사용자 콜백 호출
 *
 * NOTE: `direction: 'both'`는 1차 구현에서 `horizontal`로 폴백합니다.
 *       대각 스크롤 + 스냅 정책은 후속 minor 릴리스에서 정식 지원.
 */
export function createScrollContainer(
  root: HTMLElement,
  options: ScrollContainerOptions,
): ScrollContainerInstance {
  // --- 옵션 검증 + 정규화 ---
  validateOptions(options);

  const panelCount = options.panels.length;
  const initialIndex = clampIndex(options.initialIndex ?? 0, panelCount);
  const minZoom = options.minZoom ?? 1.0;
  const maxZoom = options.maxZoom ?? 3.0;
  const initialZoom = clampZoom(1, minZoom, maxZoom);

  // --- SSR 가드 — 모듈 로드/팩토리 호출 시점에 DOM 접근하지 않음 ---
  if (typeof window === 'undefined') {
    return {
      scrollTo: () => {},
      getActiveIndex: () => initialIndex,
      zoomTo: () => {},
      getZoom: () => initialZoom,
      destroy: () => {},
    };
  }

  // --- 실 환경 옵션 정규화 ---
  const overscan = Math.max(0, options.overscan ?? 1);
  const snapThreshold = options.snapThreshold ?? 0.3;
  const resistance = options.resistance ?? 0.2;
  const enablePinchZoom = options.enablePinchZoom ?? true;
  // 'both'는 1차에서 horizontal로 폴백 (대각 스크롤은 후속 minor)
  const direction: 'horizontal' | 'vertical' =
    options.direction === 'vertical' ? 'vertical' : 'horizontal';

  // --- 컨테이너 크기 측정 ---
  let width = Math.max(1, root.clientWidth || 1);
  let height = Math.max(1, root.clientHeight || 1);

  // --- 카메라 / 렌더러 셋업 ---
  // pointer-events는 건드리지 않음 — 패널 콘텐츠 인터랙션을 보존하고, 입력은 자연 bubbling으로
  // root까지 전달되어 CameraControl이 root 리스너에서 수신.
  const camera = createCamera(initialZoom);
  const renderer = createPanelRenderer(options.panels);
  renderer.setSize(width, height);
  root.appendChild(renderer.domElement);

  // --- 패널 위치 계산 ---
  // panelSizes는 축 방향 패널 크기(가로: width, 세로: 패널 높이) — CameraControl의 줌 상태 pan 경계 계산용.
  // positions와 같은 배열 참조를 유지해 리사이즈 시 함께 갱신된다.
  const positions: Array<{ x: number; y: number }> = [];
  const panelSizes: number[] = [];
  function computePositions(): void {
    positions.length = 0;
    panelSizes.length = 0;
    if (direction === 'horizontal') {
      for (let i = 0; i < panelCount; i++) {
        positions.push({ x: i * width, y: 0 });
        panelSizes.push(width);
      }
    } else {
      let cursor = 0;
      for (let i = 0; i < panelCount; i++) {
        const h = options.panelHeight?.(i) ?? height;
        positions.push({ x: 0, y: -(cursor + h / 2) });
        panelSizes.push(h);
        cursor += h;
      }
    }
  }
  computePositions();

  // --- 패널 좌표를 렌더러에 반영 ---
  function applyPanelPositions(): void {
    for (let i = 0; i < panelCount; i++) {
      const p = positions[i];
      if (!p) continue;
      renderer.setPanelPosition(i, p.x, p.y);
    }
  }
  applyPanelPositions();

  // --- 상태 ---
  let activeIndex = initialIndex;
  let zoom = initialZoom;
  let destroyed = false;
  // 가상화 창 안/밖 상태 — mount/unmount 차분만 렌더러에 전달. null = 아직 미적용(첫 적용 때 전부 기록).
  const panelInWindow: Array<boolean | null> = new Array(panelCount).fill(null);

  // --- 내부 적용 함수 (초기 적용 + ResizeObserver 보정에서 사용) ---
  function applyActiveIndexToCameraDirectly(): void {
    const p = positions[activeIndex];
    if (!p) return;
    camera.position.x = p.x;
    camera.position.y = p.y;
  }

  function applyZoomToCameraDirectly(): void {
    camera.zoom = zoom;
  }

  // 가상화: |i - activeIndex| <= overscan 패널만 visible. mount/unmount 차분만 적용.
  function applyVirtualization(): void {
    for (let i = 0; i < panelCount; i++) {
      const inWindow = Math.abs(i - activeIndex) <= overscan;
      if (panelInWindow[i] !== inWindow) {
        panelInWindow[i] = inWindow;
        renderer.setPanelVisible(i, inWindow);
      }
    }
  }

  function requestRender(): void {
    if (destroyed) return;
    renderer.render(camera);
  }

  // --- 초기 적용 + 1회 렌더 ---
  applyVirtualization();
  applyActiveIndexToCameraDirectly();
  applyZoomToCameraDirectly();
  requestRender();

  // --- CameraControl (#3) 인스턴스화 ---
  let control: CameraControl | null = createCameraControl({
    root,
    camera,
    direction,
    positions,
    panelSizes,
    getRootSize: () => ({ width, height }),
    snapThreshold,
    resistance,
    minZoom,
    maxZoom,
    enablePinchZoom,
    onChange: requestRender,
    onPanRelease: (targetIndex) => {
      if (destroyed) return;
      // 카메라 복귀/스냅 트윈은 CameraControl이 콜백 직전에 이미 시작했다 — 여기서는 상태만 갱신.
      // (zoom ≤ 1: 패널 중심 스냅, zoom > 1: 그 자리 유지 또는 가장자리/gap 스냅)
      if (targetIndex !== activeIndex) {
        activeIndex = targetIndex;
        applyVirtualization();
        options.onIndexChange?.(activeIndex);
      }
    },
    onPinchRelease: (newZoom) => {
      if (destroyed) return;
      if (newZoom !== zoom) {
        zoom = newZoom;
        options.onZoomChange?.(zoom);
      }
    },
  });

  // --- ResizeObserver: root 사이즈 변경 시 카메라 frustum + 렌더러 사이즈 + 패널 좌표 보정 ---
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
      const newW = Math.max(1, root.clientWidth || 1);
      const newH = Math.max(1, root.clientHeight || 1);
      if (newW === width && newH === height) return;
      width = newW;
      height = newH;
      renderer.setSize(width, height);
      computePositions();
      applyPanelPositions();
      // 트윈이 진행 중이었어도 새 좌표 기준으로 즉시 보정 (resize는 드물고 명확해야 함)
      control?.cancelAnimation();
      applyActiveIndexToCameraDirectly();
      requestRender();
    });
    resizeObserver.observe(root);
  }

  // --- 공개 메서드 ---
  // scrollTo/zoomTo는 논리적 상태(activeIndex/zoom)는 즉시 업데이트하고, 카메라 이동은
  // CameraControl에 위임 (animated=true 기본). animated=false면 동기 점프.
  function scrollTo(index: number, opts?: { animated?: boolean }): void {
    if (destroyed) return;
    const next = clampIndex(index, panelCount);
    const animated = opts?.animated ?? true;
    if (next !== activeIndex) {
      activeIndex = next;
      applyVirtualization();
      options.onIndexChange?.(activeIndex);
    }
    control?.animateToIndex(next, animated);
  }

  function getActiveIndex(): number {
    return activeIndex;
  }

  function zoomTo(level: number, opts?: { animated?: boolean }): void {
    if (destroyed) return;
    const next = clampZoom(level, minZoom, maxZoom);
    const animated = opts?.animated ?? true;
    if (next !== zoom) {
      zoom = next;
      options.onZoomChange?.(zoom);
    }
    control?.animateToZoom(next, animated);
  }

  function getZoom(): number {
    return zoom;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    // 순서: 입력/RAF 정리 → 리사이즈 옵저버 → 렌더러(패널 detach + 인라인 스타일 복원 + DOM 제거)
    if (control) {
      control.destroy();
      control = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    // 렌더러가 domElement를 어디에 있든(외부에서 옮겼어도) 스스로 제거한다 (m-3).
    renderer.destroy();
  }

  return {
    scrollTo,
    getActiveIndex,
    zoomTo,
    getZoom,
    destroy,
  };
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

function clampZoom(level: number, min: number, max: number): number {
  if (!Number.isFinite(level)) return min;
  if (level < min) return min;
  if (level > max) return max;
  return level;
}

/**
 * 옵션 검증 — 잘못된 값은 즉시 `WebviewHeadlessError`로 차단해 디버깅 시간을 줄인다.
 * TypeScript 시그니처로는 잡히지 않는 범위/관계 위반만 검사.
 */
function validateOptions(options: ScrollContainerOptions): void {
  if (options.panels.length === 0) {
    throw new WebviewHeadlessError('ScrollContainer: panels must not be empty');
  }
  if (options.minZoom !== undefined && options.minZoom <= 0) {
    throw new WebviewHeadlessError(`ScrollContainer: minZoom must be > 0 (got ${options.minZoom})`);
  }
  if (
    options.minZoom !== undefined &&
    options.maxZoom !== undefined &&
    options.maxZoom < options.minZoom
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: maxZoom (${options.maxZoom}) must be >= minZoom (${options.minZoom})`,
    );
  }
  if (
    options.snapThreshold !== undefined &&
    (options.snapThreshold <= 0 || options.snapThreshold > 1)
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: snapThreshold must be in (0, 1] (got ${options.snapThreshold})`,
    );
  }
  if (options.resistance !== undefined && (options.resistance < 0 || options.resistance > 1)) {
    throw new WebviewHeadlessError(
      `ScrollContainer: resistance must be in [0, 1] (got ${options.resistance})`,
    );
  }
}
