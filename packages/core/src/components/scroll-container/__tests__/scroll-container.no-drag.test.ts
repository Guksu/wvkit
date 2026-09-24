import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebviewHeadlessError } from '../../../errors';
import { createScrollContainer } from '../scroll-container';

/**
 * noDragSelector — 패널 안 JS 캐러셀처럼 페이저가 받지 않을 영역.
 *
 * 패널마다 `.carousel`(무시 영역)과 `.other`(일반 영역)를 두고, 같은 제스처를 두 곳에서 시작해 비교한다.
 * root 400 × 600, 패널 3장, 가로.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const panel = document.createElement('div');
    panel.dataset.idx = String(i);
    const carousel = document.createElement('div');
    carousel.className = 'carousel';
    const slide = document.createElement('img');
    carousel.appendChild(slide);
    const other = document.createElement('div');
    other.className = 'other';
    panel.append(carousel, other);
    return panel;
  });
}

function pointer(
  type: string,
  target: Element,
  pointerId: number,
  clientX: number,
  clientY: number,
  isPrimary = pointerId === 1,
): void {
  target.dispatchEvent(
    new PointerEvent(type, { pointerId, clientX, clientY, isPrimary, bubbles: true }),
  );
}

/** root > domElement > scene — 카메라 transform 이 기록되는 노드 */
function sceneTransform(root: HTMLElement): string {
  return ((root.firstChild as HTMLElement).firstChild as HTMLElement).style.transform;
}

describe('createScrollContainer — noDragSelector', () => {
  let root: HTMLElement;
  let now: number;

  beforeEach(() => {
    root = makeRoot();
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  function mount(extra: Partial<Parameters<typeof createScrollContainer>[1]> = {}) {
    const panels = makePanels(3);
    const onIndexChange = vi.fn();
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      overscan: 2,
      noDragSelector: '.carousel',
      onIndexChange,
      onZoomChange,
      ...extra,
    });
    const carousel = panels[0]?.querySelector('.carousel') as HTMLElement;
    const slide = carousel.firstElementChild as HTMLElement;
    const other = panels[0]?.querySelector('.other') as HTMLElement;
    return { sc, panels, carousel, slide, other, onIndexChange, onZoomChange };
  }

  /** 200px 를 천천히 왼쪽으로 끈다 (한 칸의 절반 — 일반 영역이면 다음 패널) */
  function dragLeft(target: Element, pointerId = 1): void {
    pointer('pointerdown', target, pointerId, 300, 300);
    for (let i = 1; i <= 10; i++) {
      now += 30;
      pointer('pointermove', target, pointerId, 300 - i * 20, 300);
    }
    now += 200;
    pointer('pointerup', target, pointerId, 100, 300);
  }

  it('N1: 무시 영역(자손 포함)에서 시작한 드래그는 페이저가 받지 않는다 — 카메라도 한 번도 움직이지 않는다', () => {
    const { sc, slide, onIndexChange } = mount();
    const before = sceneTransform(root);
    pointer('pointerdown', slide, 1, 300, 300);
    for (let i = 1; i <= 10; i++) {
      now += 30;
      pointer('pointermove', slide, 1, 300 - i * 20, 300);
      expect(sceneTransform(root)).toBe(before);
    }
    pointer('pointerup', slide, 1, 100, 300);
    expect(sc.getActiveIndex()).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
    sc.destroy();
  });

  it('N2: 같은 패널의 다른 영역에서 시작한 같은 드래그는 다음 패널로 넘긴다', () => {
    const { sc, other, onIndexChange } = mount();
    dragLeft(other);
    expect(sc.getActiveIndex()).toBe(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    sc.destroy();
  });

  it('N3: 무시한 제스처가 끝난 뒤의 다음 제스처는 정상으로 받는다', () => {
    const { sc, carousel, other } = mount();
    dragLeft(carousel);
    expect(sc.getActiveIndex()).toBe(0);
    dragLeft(other);
    expect(sc.getActiveIndex()).toBe(1);
    sc.destroy();
  });

  it('N4: 끝 이벤트를 놓쳐도 새 제스처(primary 포인터)가 오면 다시 받는다', () => {
    const { sc, carousel, other } = mount();
    pointer('pointerdown', carousel, 1, 300, 300); // up 이 오지 않은 채로 남는다
    // 같은 제스처에 더해진 손가락(primary 아님)은 여전히 무시
    dragLeft(other, 2);
    expect(sc.getActiveIndex()).toBe(0);
    // 새 제스처의 첫 포인터(primary) — 무시 목록을 비우고 정상으로 받는다
    pointer('pointerdown', other, 3, 300, 300, true);
    for (let i = 1; i <= 10; i++) {
      now += 30;
      pointer('pointermove', other, 3, 300 - i * 20, 300, true);
    }
    now += 200;
    pointer('pointerup', other, 3, 100, 300, true);
    expect(sc.getActiveIndex()).toBe(1);
    sc.destroy();
  });

  it('N5: 무시 영역에서 시작한 제스처에 더해진 두 번째 손가락도 무시 — 핀치 줌이 시작되지 않는다', () => {
    const { sc, carousel, other, onZoomChange } = mount();
    pointer('pointerdown', carousel, 1, 150, 300);
    pointer('pointerdown', other, 2, 250, 300);
    pointer('pointermove', carousel, 1, 100, 300);
    pointer('pointermove', other, 2, 300, 300);
    pointer('pointerup', other, 2, 300, 300);
    pointer('pointerup', carousel, 1, 100, 300);
    expect(sc.getZoom()).toBe(1);
    expect(onZoomChange).not.toHaveBeenCalled();
    sc.destroy();
  });

  it('N6: 바깥에서 시작한 핀치는 두 번째 손가락이 무시 영역에 닿아도 그대로 줌', () => {
    const { sc, carousel, other, onZoomChange } = mount();
    pointer('pointerdown', other, 1, 150, 300);
    pointer('pointerdown', carousel, 2, 250, 300);
    pointer('pointermove', other, 1, 100, 300);
    pointer('pointermove', carousel, 2, 300, 300); // 거리 100 → 200 = 2배
    pointer('pointerup', carousel, 2, 300, 300);
    pointer('pointerup', other, 1, 100, 300);
    expect(onZoomChange).toHaveBeenCalledWith(2);
    sc.destroy();
  });

  it('N7: 무시 영역에서의 더블탭은 줌하지 않는다 (다른 영역은 줌)', () => {
    const { sc, carousel, other } = mount({ doubleTapZoom: 2 });
    for (const t of [0, 100]) {
      now = 1000 + t;
      pointer('pointerdown', carousel, 1, 200, 300);
      now += 50;
      pointer('pointerup', carousel, 1, 200, 300);
    }
    expect(sc.getZoom()).toBe(1);
    for (const t of [0, 100]) {
      now = 5000 + t;
      pointer('pointerdown', other, 1, 200, 300);
      now += 50;
      pointer('pointerup', other, 1, 200, 300);
    }
    expect(sc.getZoom()).toBe(2);
    sc.destroy();
  });

  it('N8: 무시 영역 위의 휠은 페이지를 넘기지 않고 기본 동작도 막지 않는다 — 다른 영역은 넘긴다', () => {
    const { sc, carousel, other } = mount();
    const onCarousel = new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true });
    carousel.dispatchEvent(onCarousel);
    expect(sc.getActiveIndex()).toBe(0);
    expect(onCarousel.defaultPrevented).toBe(false);
    now += 500; // 새 휠 제스처
    const onOther = new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true });
    other.dispatchEvent(onOther);
    expect(sc.getActiveIndex()).toBe(1);
    expect(onOther.defaultPrevented).toBe(true);
    sc.destroy();
  });

  it('N9: 무시 영역 위에서도 Ctrl + 휠(트랙패드 핀치) 줌은 그대로 처리한다', () => {
    const { sc, carousel, onZoomChange } = mount();
    const ev = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    // happy-dom 은 WheelEvent 의 ctrlKey·clientX 초기값을 무시한다
    Object.defineProperties(ev, {
      ctrlKey: { value: true },
      clientX: { value: 200 },
      clientY: { value: 300 },
    });
    carousel.dispatchEvent(ev);
    expect(onZoomChange).toHaveBeenCalled();
    expect(sc.getZoom()).toBeGreaterThan(1);
    expect(ev.defaultPrevented).toBe(true);
    sc.destroy();
  });

  it('N10: root 자신이나 root 바깥 조상이 선택자에 맞아도 페이저는 꺼지지 않는다 (자손만 센다)', () => {
    root.classList.add('host');
    document.body.classList.add('app');
    const { sc, other } = mount({ noDragSelector: '.host, .app' });
    dragLeft(other);
    expect(sc.getActiveIndex()).toBe(1);
    document.body.classList.remove('app');
    sc.destroy();
  });

  it('N11: 잘못된 CSS 선택자는 생성 시 WebviewHeadlessError', () => {
    // happy-dom 은 일부 잘못된 선택자(예: '.carousel[')를 받아들이므로, 브라우저와 happy-dom 모두 거부하는 값을 쓴다
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        noDragSelector: '[',
      }),
    ).toThrow(WebviewHeadlessError);
  });
});
