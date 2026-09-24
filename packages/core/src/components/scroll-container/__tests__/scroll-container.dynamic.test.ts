import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebviewHeadlessError } from '../../../errors';
import { createScrollContainer } from '../scroll-container';

/**
 * setPanels · setOptions — 다시 마운트하지 않고 패널·옵션을 바꾼다.
 *
 * 화면 위치는 "scene translate + 패널 translate" 로 잰다 (zoom 1: 화면 x = sceneX + panelX).
 * root 400 × 600, 가로, 전폭 패널이면 패널 i 의 중심 x = 400 i.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

function makePanel(name: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset.name = name;
  return el;
}

function makePanels(names: string[]): HTMLElement[] {
  return names.map(makePanel);
}

function scene(root: HTMLElement): HTMLElement {
  return (root.firstChild as HTMLElement).firstChild as HTMLElement;
}

/** "translate(Xpx, Ypx) ..." 의 첫 translate 값 */
function translateOf(transform: string): { x: number; y: number } {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform);
  if (!m) throw new Error(`no translate in ${transform}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

function scaleOf(transform: string): number {
  const m = /scale\((-?[\d.]+)\)/.exec(transform);
  return m ? Number(m[1]) : 1;
}

/** 패널 중심의 화면 x (root 기준) */
function screenX(root: HTMLElement, panel: HTMLElement): number {
  const s = scene(root).style.transform;
  return translateOf(s).x + translateOf(panel.style.transform).x * scaleOf(s);
}

function pointer(type: string, target: Element, clientX: number, clientY = 300): void {
  target.dispatchEvent(
    new PointerEvent(type, { pointerId: 1, clientX, clientY, isPrimary: true, bubbles: true }),
  );
}

describe('createScrollContainer — setPanels', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  it('D1: 보던 패널 앞에 끼워 넣으면 번호만 하나 늘고 화면은 그대로 — onIndexChange(새 번호)', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 2,
      onIndexChange,
    });
    const c = panels[2] as HTMLElement;
    const before = screenX(root, c);

    sc.setPanels([makePanel('new'), ...panels]);

    expect(sc.getActiveIndex()).toBe(3);
    expect(onIndexChange).toHaveBeenCalledWith(3);
    expect(screenX(root, c)).toBe(before);
    expect(c.style.transform).toContain('translate(1200px, 0px)');
    sc.destroy();
  });

  it('D2: 남는 패널은 scene 에서 한 번도 떼지 않는다 (스크롤 위치 유지의 조건)', async () => {
    const panels = makePanels(['a', 'b', 'c']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, overscan: 2 });
    const removed: Node[] = [];
    const mo = new MutationObserver((records) => {
      for (const r of records) removed.push(...Array.from(r.removedNodes));
    });
    mo.observe(scene(root), { childList: true });

    sc.setPanels([panels[0] as HTMLElement, makePanel('x'), panels[1] as HTMLElement]);
    await new Promise((r) => setTimeout(r, 0));
    mo.disconnect();

    expect(removed).toEqual([panels[2]]); // 빠진 패널만 떼어졌다
    expect(panels[0]?.parentNode).toBe(scene(root));
    expect(panels[1]?.parentNode).toBe(scene(root));
    sc.destroy();
  });

  it('D3: 보던 패널을 지우면 같은 번호 자리의 패널 — 번호가 같으면 onIndexChange 없음, 지운 패널은 원래대로', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const b = panels[1] as HTMLElement;
    b.style.transform = 'rotate(1deg)';
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
      onIndexChange,
    });
    expect(b.getAttribute('role')).toBe('group');

    sc.setPanels([panels[0] as HTMLElement, panels[2] as HTMLElement]);

    expect(sc.getActiveIndex()).toBe(1); // 'c' 가 1번 자리
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(screenX(root, panels[2] as HTMLElement)).toBe(200); // 화면 가운데
    expect(b.parentNode).toBeNull();
    expect(b.style.transform).toBe('rotate(1deg)');
    expect(b.style.position).toBe('');
    expect(b.hasAttribute('draggable')).toBe(false);
    expect(b.hasAttribute('role')).toBe(false);
    expect(b.hasAttribute('aria-hidden')).toBe(false);
    sc.destroy();
  });

  it('D4: 마지막 패널을 보다가 지우면 새 마지막 패널로 — onIndexChange(새 번호)', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 2,
      onIndexChange,
    });
    sc.setPanels(panels.slice(0, 2));
    expect(sc.getActiveIndex()).toBe(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    sc.destroy();
  });

  it('D5: ARIA 번호("n / N")를 새 목록으로 다시 매기고, 새 패널은 기본 스타일로 받는다', () => {
    const panels = makePanels(['a', 'b']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, overscan: 3 });
    const added = makePanel('c');
    sc.setPanels([...panels, added]);
    expect(panels.map((p) => p.getAttribute('aria-label'))).toEqual(['1 / 3', '2 / 3']);
    expect(added.getAttribute('aria-label')).toBe('3 / 3');
    expect(added.style.position).toBe('absolute');
    expect(added.getAttribute('draggable')).toBe('false');
    expect(added.parentNode).toBe(scene(root));
    sc.destroy();
  });

  it('D6: 빈 목록·같은 요소 두 번은 WebviewHeadlessError — 상태는 그대로', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, initialIndex: 1 });
    const before = scene(root).style.transform;
    expect(() => sc.setPanels([])).toThrow(WebviewHeadlessError);
    expect(() => sc.setPanels([panels[0] as HTMLElement, panels[0] as HTMLElement])).toThrow(
      WebviewHeadlessError,
    );
    expect(sc.getActiveIndex()).toBe(1);
    expect(scene(root).style.transform).toBe(before);
    expect(panels[2]?.parentNode).toBe(scene(root));
    sc.destroy();
  });

  it('D7: destroy 는 지금 목록의 패널을 원래대로 돌린다', () => {
    const panels = makePanels(['a', 'b']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, overscan: 2 });
    const added = makePanel('c');
    sc.setPanels([panels[0] as HTMLElement, added]);
    sc.destroy();
    for (const p of [panels[0] as HTMLElement, added]) {
      expect(p.parentNode).toBeNull();
      expect(p.style.position).toBe('');
      expect(p.hasAttribute('role')).toBe(false);
    }
    expect(root.childElementCount).toBe(0);
  });

  it('D8: 줌 상태에서 앞에 끼워 넣어도 보던 지점이 화면에서 움직이지 않는다 (줌·pan 위치 유지)', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
      onZoomChange,
    });
    sc.zoomTo(2, { animated: false });
    // 휠로 줌 상태 pan — 카메라를 패널 중심에서 옮겨 둔다
    root.dispatchEvent(new WheelEvent('wheel', { deltaX: 60, bubbles: true, cancelable: true }));
    const b = panels[1] as HTMLElement;
    const before = screenX(root, b);
    expect(before).not.toBe(200); // 가운데가 아님 (pan 됨)
    onZoomChange.mockClear();

    sc.setPanels([makePanel('new'), ...panels]);

    expect(sc.getZoom()).toBe(2);
    expect(onZoomChange).not.toHaveBeenCalled();
    expect(screenX(root, b)).toBe(before);
    sc.destroy();
  });
});

describe('createScrollContainer — setOptions', () => {
  let root: HTMLElement;
  let rafQueue: FrameRequestCallback[];
  beforeEach(() => {
    root = makeRoot();
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      rafQueue.length = 0;
    });
  });
  afterEach(() => {
    root.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('O1: 콜백만 바꾸면 진행 중인 애니메이션을 건드리지 않고, 새 콜백을 쓴다', () => {
    const first = vi.fn();
    const second = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(['a', 'b', 'c']),
      onIndexChange: first,
    });
    sc.scrollTo(1); // 애니메이션 시작 (RAF 대기 중)
    expect(rafQueue.length).toBe(1);
    sc.setOptions({ onIndexChange: second });
    expect(rafQueue.length).toBe(1); // 취소되지 않음
    sc.scrollTo(2, { animated: false });
    expect(second).toHaveBeenCalledWith(2);
    expect(first).toHaveBeenCalledTimes(1);
    sc.destroy();
  });

  it('O2: 같은 결과를 내는 새 함수(인라인 panelHeight)는 바뀐 것으로 보지 않는다', () => {
    const sc = createScrollContainer(root, {
      direction: 'vertical',
      panels: makePanels(['a', 'b', 'c']),
      panelHeight: () => 300,
    });
    sc.scrollTo(1);
    expect(rafQueue.length).toBe(1);
    sc.setOptions({ panelHeight: () => 300 });
    expect(rafQueue.length).toBe(1);
    sc.destroy();
  });

  it('O3: direction 을 세로로 — 패널이 세로로 쌓이고, 아래 화살표가 다음 패널로 간다', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, overscan: 2 });
    sc.setOptions({ direction: 'vertical' });
    expect(panels[1]?.style.transform).toContain('translate(0px, 900px)'); // 중심 y = −(600 + 300)
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(sc.getActiveIndex()).toBe(1);
    sc.destroy();
  });

  it('O4: snapThreshold 를 올리면 같은 드래그가 넘기지 못한다', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels });
    sc.setOptions({ snapThreshold: 0.9 });
    const now = vi.spyOn(performance, 'now');
    let t = 0;
    now.mockImplementation(() => t);
    const target = panels[0] as HTMLElement;
    pointer('pointerdown', target, 300);
    for (let i = 1; i <= 10; i++) {
      t += 30;
      pointer('pointermove', target, 300 - i * 20);
    }
    t += 300;
    pointer('pointerup', target, 100);
    expect(sc.getActiveIndex()).toBe(0);
    sc.destroy();
  });

  it('O5: overscan 을 0 으로 — 활성 패널만 보인다', () => {
    const panels = makePanels(['a', 'b', 'c', 'd']);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
      overscan: 1,
    });
    sc.setOptions({ overscan: 0 });
    expect(panels.map((p) => p.parentNode !== null && p.style.display !== 'none')).toEqual([
      false,
      true,
      false,
      false,
    ]);
    sc.destroy();
  });

  it('O6: maxZoom 을 낮추면 줌을 새 범위로 자르고 onZoomChange', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(['a', 'b']),
      onZoomChange,
    });
    sc.zoomTo(3, { animated: false });
    onZoomChange.mockClear();
    sc.setOptions({ maxZoom: 2 });
    expect(sc.getZoom()).toBe(2);
    expect(onZoomChange).toHaveBeenCalledWith(2);
    expect(scene(root).style.transform).toContain('scale(2)');
    sc.destroy();
  });

  it('O7: a11y 를 끄면 속성을 거두고, 다시 켜면 붙인다', () => {
    const panels = makePanels(['a', 'b']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels });
    sc.setOptions({ a11y: false });
    expect(root.hasAttribute('aria-roledescription')).toBe(false);
    expect(panels[1]?.hasAttribute('aria-hidden')).toBe(false);
    expect(panels[1]?.hasAttribute('inert')).toBe(false);
    sc.setOptions({ a11y: true });
    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    expect(panels[1]?.getAttribute('aria-hidden')).toBe('true');
    sc.destroy();
  });

  it('O8: 다른 옵션을 바꿔도 호스트 포커스를 잃지 않는다 · keyboard 를 끄면 붙였던 tabindex 만 뗀다', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(['a', 'b']),
    });
    root.focus();
    expect(document.activeElement).toBe(root);
    sc.setOptions({ gap: 10, wheel: false });
    expect(document.activeElement).toBe(root);
    expect(root.getAttribute('tabindex')).toBe('0');
    sc.setOptions({ keyboard: false });
    expect(root.hasAttribute('tabindex')).toBe(false);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(sc.getActiveIndex()).toBe(0);
    sc.destroy();
  });

  it('O9: 잘못된 값이면 아무것도 바꾸지 않고 WebviewHeadlessError', () => {
    const panels = makePanels(['a', 'b', 'c']);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      panelWidth: 0.8,
      initialIndex: 1,
    });
    const transforms = panels.map((p) => p.style.transform);
    const sceneBefore = scene(root).style.transform;
    expect(() => sc.setOptions({ snapThreshold: 2 })).toThrow(WebviewHeadlessError);
    expect(() => sc.setOptions({ panelWidth: () => 0 })).toThrow(WebviewHeadlessError);
    expect(panels.map((p) => p.style.transform)).toEqual(transforms);
    expect(scene(root).style.transform).toBe(sceneBefore);
    expect(panels.map((p) => p.style.width)).toEqual(['320px', '320px', '320px']);
    // 실패한 값이 남지 않았다 — 다음 변경은 예전 panelWidth(0.8) 기준: 중심 x = 320 + 8 = 328
    sc.setOptions({ gap: 8 });
    expect(panels[1]?.style.transform).toContain('translate(328px, 0px)');
    sc.destroy();
  });

  it('O10: panelWidth 를 주면 폭을 쓰고, undefined 로 되돌리면 원래 폭으로', () => {
    const panels = makePanels(['a', 'b']);
    (panels[0] as HTMLElement).style.width = '100%';
    const sc = createScrollContainer(root, { direction: 'horizontal', panels, overscan: 1 });
    sc.setOptions({ panelWidth: 0.8, gap: 16 });
    expect(panels.map((p) => p.style.width)).toEqual(['320px', '320px']);
    expect(panels[1]?.style.transform).toContain('translate(336px, 0px)');
    sc.setOptions({ panelWidth: undefined, gap: undefined });
    expect(panels.map((p) => p.style.width)).toEqual(['100%', '']);
    expect(panels[1]?.style.transform).toContain('translate(400px, 0px)');
    sc.destroy();
  });

  it('O11: setOptions 로 panels 도 함께 바꿀 수 있다 · destroy 뒤에는 아무 일도 없다', () => {
    const panels = makePanels(['a', 'b']);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels });
    const added = makePanel('c');
    sc.setOptions({ panels: [...panels, added], gap: 8 });
    expect(added.style.transform).toContain('translate(816px, 0px)');
    sc.destroy();
    expect(() => sc.setOptions({ gap: 20 })).not.toThrow();
    expect(() => sc.setPanels(panels)).not.toThrow();
    expect(root.childElementCount).toBe(0);
  });
});
