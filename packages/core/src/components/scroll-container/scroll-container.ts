import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { WebviewHeadlessError } from '../../errors';
import { type CameraControl, createCameraControl } from './camera-control';
import type { ScrollContainerInstance, ScrollContainerOptions } from './types';

/**
 * 가로/세로 패널 스크롤 컨테이너 (Three.js + CSS3DRenderer + OrthographicCamera + CameraControl).
 *
 * 아키텍처:
 *  - Scene + OrthographicCamera + CSS3DRenderer 셋업 (#4)
 *  - 패널은 CSS3DObject로 wrap해 scene에 추가, frustum + overscan 기반 가상화 (#4)
 *  - 입력 처리는 `camera-control.ts`에 위임 (#3) — axis pan, snap, edge resistance, 핀치 줌, RAF 트윈
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

  // --- Three.js scene / camera / renderer 셋업 ---
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    2000,
  );
  camera.position.set(0, 0, 1000);

  const renderer = new CSS3DRenderer();
  renderer.setSize(width, height);
  // 레이아웃 필수 인라인 스타일 (CLAUDE.md 예외): 렌더러 surface를 root 좌상단에 오버레이.
  // pointer-events는 건드리지 않음 — 패널 콘텐츠 인터랙션을 보존하고, 입력은 자연 bubbling으로
  // root까지 전달되어 CameraControl이 root 리스너에서 수신.
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  root.appendChild(renderer.domElement);

  // --- 패널 위치 계산 ---
  const positions: Array<{ x: number; y: number }> = [];
  function computePositions(): void {
    positions.length = 0;
    if (direction === 'horizontal') {
      for (let i = 0; i < panelCount; i++) {
        positions.push({ x: i * width, y: 0 });
      }
    } else {
      let cursor = 0;
      for (let i = 0; i < panelCount; i++) {
        const h = options.panelHeight?.(i) ?? height;
        positions.push({ x: 0, y: -(cursor + h / 2) });
        cursor += h;
      }
    }
  }
  computePositions();

  // --- 패널을 CSS3DObject로 wrap해서 scene에 추가 ---
  const cssObjects: CSS3DObject[] = [];
  for (let i = 0; i < panelCount; i++) {
    const panel = options.panels[i];
    const p = positions[i];
    if (!panel || !p) continue;
    // 패널 element 자체는 pointer 이벤트가 root까지 버블링되도록 자연스러운 기본 상태 유지
    const obj = new CSS3DObject(panel);
    obj.position.set(p.x, p.y, 0);
    cssObjects.push(obj);
    scene.add(obj);
  }

  // --- 상태 ---
  let activeIndex = initialIndex;
  let zoom = initialZoom;
  let destroyed = false;

  // --- 내부 적용 함수 (초기 적용 + ResizeObserver 보정에서 사용) ---
  function applyActiveIndexToCameraDirectly(): void {
    const p = positions[activeIndex];
    if (!p) return;
    camera.position.x = p.x;
    camera.position.y = p.y;
  }

  function applyZoomToCameraDirectly(): void {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  // 가상화: |i - activeIndex| <= overscan 패널만 visible. mount/unmount 차분만 적용.
  function applyVirtualization(): void {
    for (let i = 0; i < cssObjects.length; i++) {
      const obj = cssObjects[i];
      const panel = options.panels[i];
      if (!obj || !panel) continue;
      const inWindow = Math.abs(i - activeIndex) <= overscan;
      if (obj.visible !== inWindow) {
        obj.visible = inWindow;
        // CSS3DRenderer는 visible=false 객체를 일관되게 숨기지 않으므로 display 토글 병행.
        panel.style.display = inWindow ? '' : 'none';
      }
    }
  }

  function requestRender(): void {
    if (destroyed) return;
    renderer.render(scene, camera);
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
    getRootSize: () => ({ width, height }),
    snapThreshold,
    resistance,
    minZoom,
    maxZoom,
    enablePinchZoom,
    onChange: requestRender,
    onPanRelease: (targetIndex) => {
      if (destroyed) return;
      if (targetIndex !== activeIndex) {
        activeIndex = targetIndex;
        applyVirtualization();
        options.onIndexChange?.(activeIndex);
      }
      // 카메라를 정확히 패널 위치로 트윈 (스냅 + 엣지 저항 복귀)
      control?.animateToIndex(targetIndex, true);
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
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      computePositions();
      for (let i = 0; i < cssObjects.length; i++) {
        const p = positions[i];
        const obj = cssObjects[i];
        if (!p || !obj) continue;
        obj.position.set(p.x, p.y, 0);
      }
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
    // 순서: 입력/RAF 정리 → 리사이즈 옵저버 → scene 정리 → DOM 정리
    if (control) {
      control.destroy();
      control = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    for (const obj of cssObjects) {
      scene.remove(obj);
    }
    cssObjects.length = 0;
    for (const panel of options.panels) {
      panel.style.display = '';
    }
    // m-3: parentNode === root 동등성 비교를 존재성으로 완화 — 외부에서 renderer.domElement를
    // 다른 컨테이너로 옮긴 경우에도 detach가 보장됨.
    const parent = renderer.domElement.parentNode;
    if (parent) {
      parent.removeChild(renderer.domElement);
    }
    // m-4: scene이 보유한 CSS3DObject 참조를 일괄 해제. camera/renderer 자체는 클로저 GC가 처리 —
    // destroy 이후 외부에서 더 이상 접근하지 않으므로 명시적 null 할당 없이도 회수됨.
    scene.clear();
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
    throw new WebviewHeadlessError(
      `ScrollContainer: minZoom must be > 0 (got ${options.minZoom})`,
    );
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
  if (
    options.resistance !== undefined &&
    (options.resistance < 0 || options.resistance > 1)
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: resistance must be in [0, 1] (got ${options.resistance})`,
    );
  }
}
