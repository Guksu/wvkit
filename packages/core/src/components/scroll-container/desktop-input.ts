/**
 * 데스크톱 입력 — 휠·트랙패드·키보드. WebView 팀도 데스크톱 브라우저에서 개발하고 QA 하므로
 * 포인터 드래그 없이도 페이저를 움직일 수 있어야 한다. 터치 기기에서는 이 이벤트가 오지 않아 비용이 없다.
 *
 * 휠 (`wheel`, passive:false — 소비할 때만 preventDefault):
 *  - 페이저(zoom ≤ 1): 축 방향 델타를 제스처 단위로 누적해 `WHEEL_PAGE_THRESHOLD_PX` 를 넘으면 한 패널 넘긴다.
 *    한 제스처(이벤트 간격 `WHEEL_GESTURE_GAP_MS` 이내가 이어지는 동안)에 최대 한 패널 — 트랙패드 관성이
 *    여러 패널을 넘기지 않게 (네이티브 페이저·Swiper mousewheel 과 같은 규칙).
 *    교차 축 성분이 더 크면(세로 스크롤 의도) 손대지 않는다. 축 방향으로 더 스크롤할 수 있는 중첩 스크롤러
 *    (칩 줄 등) 위에서는 네이티브에 맡긴다.
 *  - 줌 상태(zoom > 1): 휠은 카메라 pan (양 축, 패널 범위 안). 그 방향으로 스크롤할 수 있는 조상이 있으면 네이티브 우선.
 *  - ctrl+휠 (트랙패드 핀치가 브라우저에서 이렇게 온다): 커서 아래 지점을 고정한 채 줌 `exp(−deltaY × 0.01)`.
 *
 * 키보드 (`keydown`, 포커스가 host 자신에 있을 때만 — 패널 안 인풋·버튼에서는 관여하지 않는다):
 *  - 축 방향 화살표: 이전/다음 패널. Home/End: 첫/끝 패널. Escape: 줌 상태면 minZoom 으로.
 *  - host 에 tabindex 가 없으면 0 을 준다 (destroy 시 제거).
 */

const WHEEL_GESTURE_GAP_MS = 120;
const WHEEL_PAGE_THRESHOLD_PX = 40;
/** deltaMode 1(줄)·2(페이지) 를 px 로 — 줄은 브라우저 관례 16px, 페이지는 패널 크기 */
const WHEEL_LINE_PX = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.01;

export interface DesktopInputOptions {
  root: HTMLElement;
  direction: 'horizontal' | 'vertical';
  wheel: boolean;
  keyboard: boolean;
  /** 정착(논리) 줌 — 카메라 트윈 중간값이 아닌 host 가 보고하는 값 */
  getZoom: () => number;
  minZoom: number;
  /** 축 방향 패널 크기(px) — deltaMode 2(페이지) 환산용 */
  getPanelSize: () => number;
  /** 한 패널 이동 (+1 다음 / −1 이전). host 의 scrollTo 로 activeIndex·가상화·콜백까지 처리 */
  step: (delta: 1 | -1) => void;
  goToEdge: (edge: 'first' | 'last') => void;
  /** 줌 상태 휠 pan (화면 px) */
  panBy: (dxPx: number, dyPx: number) => void;
  /** 커서 고정 줌. 결과 줌을 돌려준다 */
  zoomBy: (factor: number, sx: number, sy: number) => number;
  /** zoomBy 결과를 host 상태·onZoomChange 로 */
  onZoom: (zoom: number) => void;
  /** Escape → minZoom 으로 (애니메이션) */
  resetZoom: () => void;
  /** true 면 이 대상 위의 휠(페이지 넘김·줌 상태 pan)은 손대지 않는다. `Ctrl` + 휠 줌은 그대로 처리 */
  isNoDragTarget?: ((target: EventTarget | null) => boolean) | undefined;
}

export interface DesktopInput {
  destroy(): void;
}

/**
 * `start` 부터 `root` 직전까지 올라가며, `axis` 방향으로 `delta` 부호 쪽에 더 스크롤할 수 있는 요소가 있으면 true.
 * 브라우저의 스크롤 체이닝과 같은 판단 — 있으면 휠을 네이티브에 맡긴다.
 */
export function canScrollNatively(
  start: EventTarget | null,
  root: HTMLElement,
  axis: 'x' | 'y',
  delta: number,
): boolean {
  let el: Element | null = start instanceof Element ? start : null;
  while (el && el !== root) {
    const cs = getComputedStyle(el);
    const overflow = axis === 'x' ? cs.overflowX : cs.overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
      const size = axis === 'x' ? el.clientWidth : el.clientHeight;
      const scrollSize = axis === 'x' ? el.scrollWidth : el.scrollHeight;
      const pos = axis === 'x' ? el.scrollLeft : el.scrollTop;
      if (scrollSize > size + 1) {
        if (delta > 0 ? pos + size < scrollSize - 1 : pos > 0) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export function createDesktopInput(opts: DesktopInputOptions): DesktopInput {
  const {
    root,
    direction,
    wheel,
    keyboard,
    getZoom,
    minZoom,
    getPanelSize,
    step,
    goToEdge,
    panBy,
    zoomBy,
    onZoom,
    resetZoom,
    isNoDragTarget,
  } = opts;
  const axis: 'x' | 'y' = direction === 'horizontal' ? 'x' : 'y';
  const listeners: Array<() => void> = [];

  // --- 휠 제스처 상태 ---
  let accum = 0;
  let lastWheelTime = Number.NEGATIVE_INFINITY;
  let pagedThisGesture = false;

  function onWheel(ev: WheelEvent): void {
    const now = performance.now();
    if (now - lastWheelTime > WHEEL_GESTURE_GAP_MS) {
      accum = 0;
      pagedThisGesture = false;
    }
    lastWheelTime = now;

    const unit = ev.deltaMode === 1 ? WHEEL_LINE_PX : ev.deltaMode === 2 ? getPanelSize() : 1;
    const dx = ev.deltaX * unit;
    const dy = ev.deltaY * unit;

    // ctrl+휠 = 트랙패드 핀치 (브라우저 페이지 줌을 대신한다) → 커서 고정 줌
    if (ev.ctrlKey) {
      if (dy === 0) return;
      const rect = root.getBoundingClientRect();
      const z = zoomBy(
        Math.exp(-dy * WHEEL_ZOOM_SENSITIVITY),
        ev.clientX - rect.left,
        ev.clientY - rect.top,
      );
      onZoom(z);
      ev.preventDefault();
      return;
    }

    // 무시 영역(패널 안 캐러셀 등) 위의 휠은 그 요소·페이지에 맡긴다
    if (isNoDragTarget?.(ev.target)) return;

    // 줌 상태: 카메라 pan (그 방향으로 스크롤할 수 있는 조상이 있으면 네이티브 우선)
    if (getZoom() > 1) {
      const useX = dx !== 0 && !canScrollNatively(ev.target, root, 'x', dx);
      const useY = dy !== 0 && !canScrollNatively(ev.target, root, 'y', dy);
      if (!useX && !useY) return;
      panBy(useX ? dx : 0, useY ? dy : 0);
      ev.preventDefault();
      return;
    }

    // 페이저: 축 방향 성분만, 교차 축이 더 크면 세로(가로) 스크롤 의도로 보고 손대지 않는다
    const axisDelta = axis === 'x' ? dx : dy;
    const crossDelta = axis === 'x' ? dy : dx;
    if (axisDelta === 0 || Math.abs(crossDelta) > Math.abs(axisDelta)) return;
    if (canScrollNatively(ev.target, root, axis, axisDelta)) return;
    // 소비: 페이지 가로 스크롤·macOS 가로 스와이프 뒤로가기 방지
    ev.preventDefault();
    if (pagedThisGesture) return;
    accum += axisDelta;
    if (Math.abs(accum) >= WHEEL_PAGE_THRESHOLD_PX) {
      pagedThisGesture = true;
      step(accum > 0 ? 1 : -1);
    }
  }

  // --- 키보드 ---
  function onKeyDown(ev: KeyboardEvent): void {
    // 패널 안 인풋·버튼 등에 포커스가 있으면 관여하지 않는다 — 호스트 자신에 포커스가 있을 때만
    if (ev.target !== root) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const prevKey = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    switch (ev.key) {
      case nextKey:
        step(1);
        break;
      case prevKey:
        step(-1);
        break;
      case 'Home':
        goToEdge('first');
        break;
      case 'End':
        goToEdge('last');
        break;
      case 'Escape':
        if (!(getZoom() > minZoom)) return;
        resetZoom();
        break;
      default:
        return;
    }
    ev.preventDefault();
  }

  let addedTabIndex = false;
  if (wheel) {
    root.addEventListener('wheel', onWheel, { passive: false });
    listeners.push(() => root.removeEventListener('wheel', onWheel));
  }
  if (keyboard) {
    root.addEventListener('keydown', onKeyDown);
    listeners.push(() => root.removeEventListener('keydown', onKeyDown));
    if (!root.hasAttribute('tabindex')) {
      root.setAttribute('tabindex', '0');
      addedTabIndex = true;
    }
  }

  function destroy(): void {
    for (const off of listeners) off();
    listeners.length = 0;
    if (addedTabIndex) root.removeAttribute('tabindex');
  }

  return { destroy };
}
