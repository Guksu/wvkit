import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canScrollNatively, createDesktopInput } from '../desktop-input';

/**
 * 데스크톱 입력 단위 테스트 — 휠·트랙패드·키보드.
 *
 * 계약:
 *  - 페이저(zoom ≤ 1): 축 방향 휠을 제스처(이벤트 간격 120ms 이내) 단위로 누적, 40px 넘으면 한 패널. 한 제스처에 최대 한 패널.
 *    교차 축이 더 크면 무시, 축 방향으로 더 스크롤할 수 있는 중첩 스크롤러 위면 무시. 소비한 휠만 preventDefault.
 *  - 줌 상태(zoom > 1): 휠 = panBy(dx, dy) (스크롤 가능한 조상이 있는 축은 제외).
 *  - ctrl+휠: zoomBy(exp(−dy×0.01), 커서 로컬 좌표) → onZoom.
 *  - 키보드: 호스트에 포커스(target === root)일 때만. 축 화살표·Home·End·Escape(줌 상태만). 수정키 조합 무시.
 *  - keyboard=true 이고 host 에 tabindex 가 없으면 0 을 주고 destroy 시 제거.
 */

function makeRoot(): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(root);
  return root;
}

describe('createDesktopInput', () => {
  let root: HTMLElement;
  let now: number;
  let zoom: number;
  let step: ReturnType<typeof vi.fn>;
  let goToEdge: ReturnType<typeof vi.fn>;
  let panBy: ReturnType<typeof vi.fn>;
  let zoomBy: ReturnType<typeof vi.fn>;
  let onZoom: ReturnType<typeof vi.fn>;
  let resetZoom: ReturnType<typeof vi.fn>;

  function make(extra: Partial<Parameters<typeof createDesktopInput>[0]> = {}) {
    return createDesktopInput({
      root,
      direction: 'horizontal',
      wheel: true,
      keyboard: true,
      getZoom: () => zoom,
      minZoom: 1,
      getPanelSize: () => 400,
      step,
      goToEdge,
      panBy,
      zoomBy,
      onZoom,
      resetZoom,
      ...extra,
    });
  }

  function wheel(
    init: { deltaX?: number; deltaY?: number; deltaMode?: number; ctrlKey?: boolean },
    target: HTMLElement = root,
  ): WheelEvent {
    const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return ev;
  }

  function key(k: string, init: KeyboardEventInit = {}, target: HTMLElement = root): KeyboardEvent {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return ev;
  }

  beforeEach(() => {
    root = makeRoot();
    now = 1000;
    zoom = 1;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    step = vi.fn();
    goToEdge = vi.fn();
    panBy = vi.fn();
    zoomBy = vi.fn((f: number) => Math.min(3, Math.max(1, zoom * f)));
    onZoom = vi.fn();
    resetZoom = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    root.remove();
  });

  describe('휠 — 페이저', () => {
    it('W1: 가로 휠 누적 40px 이상 → step(1) 한 번, 같은 제스처의 후속 이벤트(관성)는 무시하고 preventDefault 만', () => {
      const d = make();
      const e1 = wheel({ deltaX: 25 });
      expect(step).not.toHaveBeenCalled();
      expect(e1.defaultPrevented).toBe(true); // 축 방향 휠은 페이지 가로 스크롤을 막기 위해 항상 소비
      now += 16;
      wheel({ deltaX: 25 }); // 누적 50 ≥ 40
      expect(step).toHaveBeenCalledTimes(1);
      expect(step).toHaveBeenCalledWith(1);
      for (let i = 0; i < 10; i++) {
        now += 16;
        wheel({ deltaX: 60 }); // 트랙패드 관성
      }
      expect(step).toHaveBeenCalledTimes(1);
      d.destroy();
    });

    it('W2: 120ms 넘게 조용하면 새 제스처 — 다시 넘길 수 있다. 음수 델타는 step(−1)', () => {
      const d = make();
      wheel({ deltaX: 100 });
      expect(step).toHaveBeenLastCalledWith(1);
      now += 200;
      wheel({ deltaX: -100 });
      expect(step).toHaveBeenLastCalledWith(-1);
      expect(step).toHaveBeenCalledTimes(2);
      d.destroy();
    });

    it('W3: 교차 축 성분이 더 크면(세로 스크롤 의도) 손대지 않는다 — preventDefault 없음', () => {
      const d = make();
      const ev = wheel({ deltaX: 10, deltaY: 100 });
      expect(step).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
      d.destroy();
    });

    it('W4: deltaMode 1(줄)은 16px, 2(페이지)는 패널 크기로 환산', () => {
      const d = make();
      wheel({ deltaX: 2, deltaMode: 1 }); // 32px < 40
      expect(step).not.toHaveBeenCalled();
      now += 16;
      wheel({ deltaX: 1, deltaMode: 1 }); // 누적 48
      expect(step).toHaveBeenCalledTimes(1);
      now += 200;
      wheel({ deltaX: 1, deltaMode: 2 }); // 400px
      expect(step).toHaveBeenCalledTimes(2);
      d.destroy();
    });

    it('W5: 축 방향으로 더 스크롤할 수 있는 중첩 스크롤러(칩 줄) 위에서는 네이티브에 맡긴다', () => {
      const d = make();
      const chips = document.createElement('div');
      chips.style.overflowX = 'auto';
      Object.defineProperty(chips, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(chips, 'scrollWidth', { value: 800, configurable: true });
      chips.scrollLeft = 0;
      root.appendChild(chips);
      const ev = wheel({ deltaX: 100 }, chips);
      expect(step).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
      // 끝까지 스크롤된 뒤에는 페이저가 받는다
      chips.scrollLeft = 600;
      now += 200;
      wheel({ deltaX: 100 }, chips);
      expect(step).toHaveBeenCalledWith(1);
      d.destroy();
    });

    it('W6: vertical 은 deltaY 가 축 — 아래로 100 → step(1)', () => {
      const d = make({ direction: 'vertical' });
      wheel({ deltaY: 100 });
      expect(step).toHaveBeenCalledWith(1);
      d.destroy();
    });

    it('W7: wheel=false 면 휠을 듣지 않는다', () => {
      const d = make({ wheel: false });
      const ev = wheel({ deltaX: 100 });
      expect(step).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
      d.destroy();
    });
  });

  describe('휠 — 줌 상태 · ctrl+휠', () => {
    it('Z1: zoom > 1 이면 휠은 panBy(dx, dy) — 페이지를 넘기지 않는다', () => {
      zoom = 2;
      const d = make();
      const ev = wheel({ deltaX: 30, deltaY: -20 });
      expect(panBy).toHaveBeenCalledWith(30, -20);
      expect(step).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(true);
      d.destroy();
    });

    it('Z2: zoom > 1 에서 세로로 스크롤할 수 있는 패널 위 세로 휠은 네이티브에 — 가로 성분만 pan', () => {
      zoom = 2;
      const d = make();
      const panel = document.createElement('div');
      panel.style.overflowY = 'auto';
      Object.defineProperty(panel, 'clientHeight', { value: 600, configurable: true });
      Object.defineProperty(panel, 'scrollHeight', { value: 3000, configurable: true });
      root.appendChild(panel);
      wheel({ deltaX: 0, deltaY: 50 }, panel);
      expect(panBy).not.toHaveBeenCalled();
      wheel({ deltaX: 20, deltaY: 50 }, panel);
      expect(panBy).toHaveBeenCalledWith(20, 0);
      d.destroy();
    });

    it('Z3: ctrl+휠 → zoomBy(exp(−dy×0.01), 커서 로컬 좌표) 후 onZoom(결과)', () => {
      root.getBoundingClientRect = () =>
        ({ left: 100, top: 50, width: 400, height: 600 }) as DOMRect;
      const d = make();
      const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -50 });
      // happy-dom 의 WheelEvent 는 init 의 ctrlKey/clientX/clientY 를 반영하지 않는다 — 직접 정의
      Object.defineProperties(ev, {
        ctrlKey: { value: true },
        clientX: { value: 300 },
        clientY: { value: 350 },
      });
      root.dispatchEvent(ev);
      expect(zoomBy).toHaveBeenCalledTimes(1);
      const [factor, sx, sy] = zoomBy.mock.calls[0] as [number, number, number];
      expect(factor).toBeCloseTo(Math.exp(0.5), 10);
      expect(sx).toBe(200);
      expect(sy).toBe(300);
      expect(onZoom).toHaveBeenCalledWith(Math.min(3, Math.exp(0.5)));
      expect(ev.defaultPrevented).toBe(true);
      d.destroy();
    });
  });

  describe('키보드', () => {
    it('K1: 호스트 포커스 + 축 화살표 → step, Home/End → goToEdge, preventDefault', () => {
      const d = make();
      expect(key('ArrowRight').defaultPrevented).toBe(true);
      expect(step).toHaveBeenLastCalledWith(1);
      key('ArrowLeft');
      expect(step).toHaveBeenLastCalledWith(-1);
      key('Home');
      expect(goToEdge).toHaveBeenLastCalledWith('first');
      key('End');
      expect(goToEdge).toHaveBeenLastCalledWith('last');
      // 교차 축 화살표는 무시
      expect(key('ArrowDown').defaultPrevented).toBe(false);
      expect(step).toHaveBeenCalledTimes(2);
      d.destroy();
    });

    it('K2: vertical 은 ArrowUp/ArrowDown', () => {
      const d = make({ direction: 'vertical' });
      key('ArrowDown');
      expect(step).toHaveBeenLastCalledWith(1);
      key('ArrowUp');
      expect(step).toHaveBeenLastCalledWith(-1);
      expect(key('ArrowRight').defaultPrevented).toBe(false);
      d.destroy();
    });

    it('K3: 패널 안 요소(인풋)에 포커스가 있으면 관여하지 않는다', () => {
      const d = make();
      const input = document.createElement('input');
      root.appendChild(input);
      const ev = key('ArrowRight', {}, input);
      expect(step).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
      d.destroy();
    });

    it('K4: 수정키(ctrl/alt/meta) 조합은 무시', () => {
      const d = make();
      key('ArrowRight', { ctrlKey: true });
      key('ArrowRight', { altKey: true });
      key('ArrowRight', { metaKey: true });
      expect(step).not.toHaveBeenCalled();
      d.destroy();
    });

    it('K5: Escape 는 줌 상태에서만 resetZoom', () => {
      const d = make();
      expect(key('Escape').defaultPrevented).toBe(false);
      expect(resetZoom).not.toHaveBeenCalled();
      zoom = 2;
      expect(key('Escape').defaultPrevented).toBe(true);
      expect(resetZoom).toHaveBeenCalledTimes(1);
      d.destroy();
    });

    it('K6: tabindex 가 없으면 0 을 주고 destroy 시 제거, 이미 있으면 그대로', () => {
      const d = make();
      expect(root.getAttribute('tabindex')).toBe('0');
      d.destroy();
      expect(root.hasAttribute('tabindex')).toBe(false);
      root.setAttribute('tabindex', '-1');
      const d2 = make();
      expect(root.getAttribute('tabindex')).toBe('-1');
      d2.destroy();
      expect(root.getAttribute('tabindex')).toBe('-1');
      root.removeAttribute('tabindex');
      const d3 = make({ keyboard: false });
      expect(root.hasAttribute('tabindex')).toBe(false);
      expect(key('ArrowRight').defaultPrevented).toBe(false);
      d3.destroy();
    });

    it('K7: destroy 뒤에는 휠·키 모두 무시', () => {
      const d = make();
      d.destroy();
      wheel({ deltaX: 100 });
      key('ArrowRight');
      expect(step).not.toHaveBeenCalled();
    });
  });

  describe('canScrollNatively', () => {
    it('overflow visible 인 조상만 있으면 false', () => {
      const child = document.createElement('div');
      root.appendChild(child);
      expect(canScrollNatively(child, root, 'x', 10)).toBe(false);
    });

    it('root 자신은 검사하지 않는다', () => {
      root.style.overflowX = 'auto';
      Object.defineProperty(root, 'scrollWidth', { value: 2000, configurable: true });
      expect(canScrollNatively(root, root, 'x', 10)).toBe(false);
    });

    it('스크롤 여지가 그 방향에 있을 때만 true', () => {
      const el = document.createElement('div');
      el.style.overflowY = 'scroll';
      Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
      Object.defineProperty(el, 'scrollHeight', { value: 300, configurable: true });
      root.appendChild(el);
      el.scrollTop = 0;
      expect(canScrollNatively(el, root, 'y', 10)).toBe(true);
      expect(canScrollNatively(el, root, 'y', -10)).toBe(false);
      el.scrollTop = 200;
      expect(canScrollNatively(el, root, 'y', 10)).toBe(false);
      expect(canScrollNatively(el, root, 'y', -10)).toBe(true);
    });
  });
});
