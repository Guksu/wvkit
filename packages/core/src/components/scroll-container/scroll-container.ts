import { WebviewHeadlessError } from '../../errors';
import { type A11y, createA11y } from './a11y';
import { createCamera } from './camera';
import { type CameraControl, createCameraControl } from './camera-control';
import { type DesktopInput, createDesktopInput } from './desktop-input';
import { panelCameraRange } from './matrix-utils';
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
 *    줌 상태 pan(패널 가장자리까지 이동·교차 축 pan, 릴리스 시 위치 유지), 더블탭 줌, 줌 고무줄
 *  - 데스크톱 입력(`desktop-input.ts`): 휠·트랙패드·키보드 → scrollTo / panBy / zoomBy. ARIA(`a11y.ts`)는 활성 패널만 노출
 *  - 본 파일은 CameraControl의 콜백을 받아 active/zoom 상태 갱신 + 가상화 + ARIA + 사용자 콜백 호출
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
  const doubleTapZoom = options.doubleTapZoom ?? false;
  const dragThreshold = options.dragThreshold ?? 10;
  const wheelEnabled = options.wheel ?? true;
  const keyboardEnabled = options.keyboard ?? true;
  const a11yEnabled = options.a11y ?? true;
  // 'both'는 1차에서 horizontal로 폴백 (대각 스크롤은 후속 minor)
  const direction: 'horizontal' | 'vertical' =
    options.direction === 'vertical' ? 'vertical' : 'horizontal';
  const axis: 'x' | 'y' = direction === 'horizontal' ? 'x' : 'y';
  /** 인덱스가 커지는 방향의 축 부호 — 가로 +x, 세로 −y */
  const forward: 1 | -1 = direction === 'horizontal' ? 1 : -1;
  const gap = options.gap ?? 0;
  const align = options.align ?? 'center';

  // --- 컨테이너 크기 측정 ---
  let width = Math.max(1, root.clientWidth || 1);
  let height = Math.max(1, root.clientHeight || 1);

  // --- 패널 위치 계산 ---
  // panelSizes는 축 방향 패널 크기(가로: width, 세로: 패널 높이) — CameraControl의 줌 상태 pan 경계 계산용.
  // positions와 같은 배열 참조를 유지해 리사이즈 시 함께 갱신된다.
  const positions: Array<{ x: number; y: number }> = [];
  const panelSizes: number[] = [];

  /**
   * 가로 패널 폭(px). `panelWidth` 가 0 초과 1 이하면 root 폭 비율, 1 초과면 px. 생략하면 root 폭.
   * 생성 시점(strict)에는 잘못된 값이면 throw, 리사이즈 중에는 root 폭으로 폴백한다 (ResizeObserver 안에서 throw 하지 않게).
   */
  function resolvePanelWidth(i: number, strict: boolean): number {
    const pw = options.panelWidth;
    const v = typeof pw === 'function' ? pw(i) : (pw ?? 1);
    if (!(Number.isFinite(v) && v > 0)) {
      if (strict) {
        throw new WebviewHeadlessError(
          `ScrollContainer: panelWidth must be a finite number > 0 (got ${v} for panel ${i})`,
        );
      }
      return width;
    }
    return v <= 1 ? v * width : v;
  }

  function computePositions(strict = false): void {
    positions.length = 0;
    panelSizes.length = 0;
    if (direction === 'horizontal') {
      // 첫 패널 중심을 0 에 두고 폭과 gap 을 따라 이어 붙인다 (전폭·gap 0 이면 x = i × width, 이전과 같음)
      let prevX = 0;
      let prevW = 0;
      for (let i = 0; i < panelCount; i++) {
        const w = resolvePanelWidth(i, strict);
        const x = i === 0 ? 0 : prevX + prevW / 2 + gap + w / 2;
        positions.push({ x, y: 0 });
        panelSizes.push(w);
        prevX = x;
        prevW = w;
      }
    } else {
      let cursor = 0;
      for (let i = 0; i < panelCount; i++) {
        const h = options.panelHeight?.(i) ?? height;
        positions.push({ x: 0, y: -(cursor + h / 2) });
        panelSizes.push(h);
        cursor += h + gap;
      }
    }
  }
  // 렌더러가 DOM 을 바꾸기 전에 계산한다 — panelWidth 가 잘못돼 throw 해도 root·패널이 그대로 남게
  computePositions(true);

  // --- 카메라 / 렌더러 셋업 ---
  // pointer-events는 건드리지 않음 — 패널 콘텐츠 인터랙션을 보존하고, 입력은 자연 bubbling으로
  // root까지 전달되어 CameraControl이 root 리스너에서 수신.
  const camera = createCamera(initialZoom);
  const renderer = createPanelRenderer(options.panels);
  renderer.setSize(width, height);
  root.appendChild(renderer.domElement);

  // --- 패널 좌표를 렌더러에 반영 ---
  function applyPanelPositions(): void {
    for (let i = 0; i < panelCount; i++) {
      const p = positions[i];
      if (!p) continue;
      renderer.setPanelPosition(i, p.x, p.y);
      // panelWidth 를 준 가로 페이저만 폭을 지정한다 — 아니면 앱 CSS(보통 width: 100%)에 맡긴다
      if (direction === 'horizontal' && options.panelWidth !== undefined) {
        renderer.setPanelWidth(i, panelSizes[i] ?? width);
      }
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
  /** 뷰포트(root)의 페이저 축 크기 */
  function viewportAlongAxis(): number {
    return axis === 'x' ? width : height;
  }

  /** 패널 i 의 정착 위치(축 좌표) — center 정렬·전폭이면 패널 중심, start 면 패널 시작이 화면 시작에 붙는 위치 */
  function restAxis(i: number): number {
    const p = positions[i];
    if (!p) return 0;
    const v = viewportAlongAxis();
    return panelCameraRange(p[axis], panelSizes[i] ?? v, v, zoom, align, forward).rest;
  }

  function applyActiveIndexToCameraDirectly(): void {
    const p = positions[activeIndex];
    if (!p) return;
    const a = restAxis(activeIndex);
    camera.position.x = axis === 'x' ? a : p.x;
    camera.position.y = axis === 'y' ? a : p.y;
  }

  function applyZoomToCameraDirectly(): void {
    camera.zoom = zoom;
  }

  // ARIA: 활성 패널만 노출 (비활성은 aria-hidden + inert). 활성 인덱스가 바뀔 때마다 갱신.
  const a11y: A11y | null = a11yEnabled ? createA11y(root, options.panels) : null;

  /**
   * 활성 패널에 정착했을 때 화면에 보이는 패널 범위 (인덱스). 전폭 패널이면 활성 하나뿐이고,
   * 좁은 패널(피킹)·zoom < 1 이면 이웃도 들어온다. s 공간(인덱스가 커지는 쪽이 +)에서 겹침으로 판정.
   */
  function visibleRange(): { first: number; last: number } {
    const v = viewportAlongAxis();
    const cam = forward * restAxis(activeIndex);
    const half = v / (2 * (zoom > 0 ? zoom : 1));
    let first = activeIndex;
    let last = activeIndex;
    for (let i = 0; i < panelCount; i++) {
      const c = forward * (positions[i]?.[axis] ?? 0);
      const hs = (panelSizes[i] ?? v) / 2;
      // 0.5px 넘게 겹쳐야 보인다고 본다 (전폭 패널의 이웃은 경계에 딱 닿기만 한다)
      if (Math.min(c + hs, cam + half) - Math.max(c - hs, cam - half) > 0.5) {
        first = Math.min(first, i);
        last = Math.max(last, i);
      }
    }
    return { first, last };
  }

  // 가상화: 화면에 보이는 패널 + 양쪽 overscan 장만 visible. mount/unmount 차분만 적용.
  // (전폭 패널이면 이전과 같이 |i − activeIndex| ≤ overscan)
  function applyVirtualization(): void {
    const { first, last } = visibleRange();
    for (let i = 0; i < panelCount; i++) {
      const inWindow = i >= first - overscan && i <= last + overscan;
      if (panelInWindow[i] !== inWindow) {
        panelInWindow[i] = inWindow;
        renderer.setPanelVisible(i, inWindow);
      }
    }
    a11y?.setActive(activeIndex);
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

  /**
   * `noDragSelector` — 누른 요소에서 가장 가까운 일치 요소가 root 안(자손)에 있으면 페이저가 받지 않는다.
   * root 자신이나 root 바깥 조상이 일치하는 것은 세지 않는다 (페이저 전체가 꺼지지 않게).
   */
  const noDragSelector = options.noDragSelector;
  const isNoDragTarget = noDragSelector
    ? (target: EventTarget | null): boolean => {
        const hit = target instanceof Element ? target.closest(noDragSelector) : null;
        return hit !== null && hit !== root && root.contains(hit);
      }
    : undefined;

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
    doubleTapZoom,
    dragThreshold,
    align,
    isNoDragTarget,
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
      // 핀치 릴리스·더블탭 공통 — 컨트롤이 범위 안 값만 준다 (고무줄 복귀 트윈은 컨트롤이 소유).
      if (newZoom !== zoom) {
        zoom = newZoom;
        applyVirtualization(); // 줌에 따라 화면에 보이는 패널 수가 달라진다
        options.onZoomChange?.(zoom);
      }
    },
  });

  // --- 데스크톱 입력 (휠·트랙패드·키보드) — 터치 기기에서는 이벤트가 오지 않는다 ---
  let desktopInput: DesktopInput | null =
    wheelEnabled || keyboardEnabled
      ? createDesktopInput({
          root,
          direction,
          wheel: wheelEnabled,
          keyboard: keyboardEnabled,
          getZoom: () => zoom,
          minZoom,
          getPanelSize: () =>
            panelSizes[activeIndex] ?? (direction === 'horizontal' ? width : height),
          step: (delta) => scrollTo(activeIndex + delta),
          goToEdge: (edge) => scrollTo(edge === 'first' ? 0 : panelCount - 1),
          panBy: (dx, dy) => control?.panBy(dx, dy),
          zoomBy: (factor, sx, sy) => control?.zoomBy(factor, sx, sy) ?? zoom,
          onZoom: (z) => {
            if (destroyed || z === zoom) return;
            zoom = z;
            applyVirtualization();
            options.onZoomChange?.(zoom);
          },
          resetZoom: () => zoomTo(minZoom),
          isNoDragTarget,
        })
      : null;

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
      applyVirtualization(); // px 폭 패널은 화면 폭이 바뀌면 보이는 장수가 달라진다
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
      applyVirtualization();
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
    // 순서: 입력/RAF 정리 → 리사이즈 옵저버 → ARIA 복원 → 렌더러(패널 detach + 인라인 스타일 복원 + DOM 제거)
    if (desktopInput) {
      desktopInput.destroy();
      desktopInput = null;
    }
    if (control) {
      control.destroy();
      control = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    a11y?.destroy();
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
  if (options.noDragSelector !== undefined && typeof document !== 'undefined') {
    try {
      document.createDocumentFragment().querySelector(options.noDragSelector);
    } catch {
      throw new WebviewHeadlessError(
        `ScrollContainer: noDragSelector is not a valid CSS selector (got ${options.noDragSelector})`,
      );
    }
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
  if (options.doubleTapZoom !== undefined && options.doubleTapZoom !== false) {
    const min = options.minZoom ?? 1.0;
    const max = options.maxZoom ?? 3.0;
    const level = options.doubleTapZoom;
    if (!Number.isFinite(level) || level <= min || level > max) {
      throw new WebviewHeadlessError(
        `ScrollContainer: doubleTapZoom must be in (minZoom, maxZoom] (got ${level}, minZoom ${min}, maxZoom ${max})`,
      );
    }
  }
  if (
    options.snapThreshold !== undefined &&
    (options.snapThreshold <= 0 || options.snapThreshold > 1)
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: snapThreshold must be in (0, 1] (got ${options.snapThreshold})`,
    );
  }
  if (options.gap !== undefined && !(Number.isFinite(options.gap) && options.gap >= 0)) {
    throw new WebviewHeadlessError(
      `ScrollContainer: gap must be a finite number >= 0 (got ${options.gap})`,
    );
  }
  if (
    typeof options.panelWidth === 'number' &&
    !(Number.isFinite(options.panelWidth) && options.panelWidth > 0)
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: panelWidth must be a finite number > 0 (got ${options.panelWidth})`,
    );
  }
  if (
    options.dragThreshold !== undefined &&
    !(Number.isFinite(options.dragThreshold) && options.dragThreshold >= 0)
  ) {
    throw new WebviewHeadlessError(
      `ScrollContainer: dragThreshold must be a finite number >= 0 (got ${options.dragThreshold})`,
    );
  }
  if (options.resistance !== undefined && (options.resistance < 0 || options.resistance > 1)) {
    throw new WebviewHeadlessError(
      `ScrollContainer: resistance must be in [0, 1] (got ${options.resistance})`,
    );
  }
}
