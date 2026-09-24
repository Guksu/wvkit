import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebviewHeadlessError } from '../../../errors';
import { createScrollContainer } from '../scroll-container';

/**
 * ScrollContainer 종합 단위 테스트.
 * 행렬·축 제약·zoom clamp의 미세 수치 검증은 matrix-utils 테스트에서 처리.
 * 본 파일은 createScrollContainer 인스턴스의 라이프사이클·콜백·가상화·옵션 검증 분기에 집중.
 */

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.idx = String(i);
    return el;
  });
}

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

describe('createScrollContainer — initialization', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('attaches the renderer surface as child of root', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
    });
    expect(root.children.length).toBeGreaterThan(0);
    sc.destroy();
  });

  it('returns instance with all 5 public methods', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
    });
    expect(typeof sc.scrollTo).toBe('function');
    expect(typeof sc.getActiveIndex).toBe('function');
    expect(typeof sc.zoomTo).toBe('function');
    expect(typeof sc.getZoom).toBe('function');
    expect(typeof sc.destroy).toBe('function');
    sc.destroy();
  });

  it('initial activeIndex matches initialIndex option (clamped)', () => {
    const sc1 = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(5),
      initialIndex: 2,
    });
    expect(sc1.getActiveIndex()).toBe(2);
    sc1.destroy();

    // out-of-range clamps to last
    const sc2 = createScrollContainer(makeRoot(), {
      direction: 'horizontal',
      panels: makePanels(3),
      initialIndex: 99,
    });
    expect(sc2.getActiveIndex()).toBe(2);
    sc2.destroy();
  });

  it('initial zoom is 1 (clamped within min/max)', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      minZoom: 0.5,
      maxZoom: 2,
    });
    expect(sc.getZoom()).toBe(1);
    sc.destroy();
  });
});

describe('createScrollContainer — SSR guard', () => {
  it('returns noop instance when window is undefined', () => {
    const originalWindow = globalThis.window;
    // 렌더러는 createScrollContainer 호출 시점에 DOM을 만들므로,
    // 호출 직전 window를 제거 → SSR 분기 진입, 호출 직후 복구하여 다른 테스트에 영향 없음.
    // typeof window === 'undefined' 체크는 글로벌 식별자 window가 undefined일 때 true.
    // (validateOptions는 SSR 환경에서도 동작하므로 유효한 옵션을 전달 — 빈 panels는 throw 됨)
    (globalThis as { window?: unknown }).window = undefined;
    try {
      const sc = createScrollContainer({} as HTMLElement, {
        direction: 'horizontal',
        panels: [document.createElement('div')],
        initialIndex: 0,
      });
      expect(sc.getActiveIndex()).toBe(0);
      expect(sc.getZoom()).toBe(1);
      expect(() => sc.scrollTo(5)).not.toThrow();
      expect(() => sc.zoomTo(2)).not.toThrow();
      // noop 인스턴스 — scrollTo/zoomTo 호출 후에도 상태 불변 (B-22)
      expect(sc.getActiveIndex()).toBe(0);
      expect(sc.getZoom()).toBe(1);
      expect(() => sc.destroy()).not.toThrow();
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

describe('createScrollContainer — virtualization', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('overscan=0 + 5 panels at index 0 → only panel 0 visible', () => {
    const panels = makePanels(5);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 0,
      overscan: 0,
    });
    expect(panels[0]!.style.display).toBe('');
    expect(panels[1]!.style.display).toBe('none');
    expect(panels[4]!.style.display).toBe('none');
    sc.destroy();
  });

  it('overscan=1 → [active-1, active, active+1] visible', () => {
    const panels = makePanels(5);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 2,
      overscan: 1,
    });
    expect(panels[0]!.style.display).toBe('none');
    expect(panels[1]!.style.display).toBe('');
    expect(panels[2]!.style.display).toBe('');
    expect(panels[3]!.style.display).toBe('');
    expect(panels[4]!.style.display).toBe('none');
    sc.destroy();
  });

  it('scrollTo updates virtualization window', () => {
    const panels = makePanels(5);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 0,
      overscan: 0,
    });
    expect(panels[0]!.style.display).toBe('');
    expect(panels[2]!.style.display).toBe('none');
    sc.scrollTo(2);
    expect(panels[0]!.style.display).toBe('none');
    expect(panels[2]!.style.display).toBe('');
    sc.destroy();
  });

  it('overscan defaults to 1 when omitted', () => {
    const panels = makePanels(5);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 2,
    });
    expect(panels[1]!.style.display).toBe('');
    expect(panels[3]!.style.display).toBe('');
    expect(panels[0]!.style.display).toBe('none');
    expect(panels[4]!.style.display).toBe('none');
    sc.destroy();
  });
});

describe('createScrollContainer — scrollTo', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('fires onIndexChange once with new index', () => {
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(4),
      onIndexChange,
    });
    sc.scrollTo(2);
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(2);
    sc.destroy();
  });

  it('does not re-fire when scrollTo target equals current index', () => {
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(4),
      onIndexChange,
    });
    sc.scrollTo(2);
    sc.scrollTo(2);
    sc.scrollTo(2);
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    sc.destroy();
  });

  it('clamps out-of-range index', () => {
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
      onIndexChange,
    });
    sc.scrollTo(99);
    expect(sc.getActiveIndex()).toBe(2);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    sc.scrollTo(-5);
    expect(sc.getActiveIndex()).toBe(0);
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    sc.destroy();
  });

  it('getActiveIndex reflects state synchronously after scrollTo', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(5),
    });
    sc.scrollTo(3);
    expect(sc.getActiveIndex()).toBe(3);
    sc.destroy();
  });

  it('animated=false also updates state synchronously', () => {
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(4),
      onIndexChange,
    });
    sc.scrollTo(2, { animated: false });
    expect(sc.getActiveIndex()).toBe(2);
    expect(onIndexChange).toHaveBeenCalledWith(2);
    sc.destroy();
  });
});

describe('createScrollContainer — zoomTo', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('clamps to maxZoom', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      minZoom: 1,
      maxZoom: 2,
      onZoomChange,
    });
    sc.zoomTo(5);
    expect(sc.getZoom()).toBe(2);
    expect(onZoomChange).toHaveBeenLastCalledWith(2);
    sc.destroy();
  });

  it('clamps to minZoom', () => {
    const onZoomChange = vi.fn();
    // 초기 zoom은 clamp(1, minZoom, maxZoom)이므로 minZoom=0.5 로 두면 초기 zoom=1.
    // 그 상태에서 zoomTo(0)은 minZoom=0.5로 클램프되며 1≠0.5이므로 콜백이 발화한다.
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      minZoom: 0.5,
      maxZoom: 2,
      onZoomChange,
    });
    sc.zoomTo(0);
    expect(sc.getZoom()).toBe(0.5);
    expect(onZoomChange).toHaveBeenLastCalledWith(0.5);
    sc.destroy();
  });

  it('does not re-fire onZoomChange when zoomTo target equals current', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      minZoom: 1,
      maxZoom: 3,
      onZoomChange,
    });
    sc.zoomTo(2);
    sc.zoomTo(2);
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    sc.destroy();
  });

  it('defaults minZoom=1 maxZoom=3 when omitted', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
    });
    sc.zoomTo(10);
    expect(sc.getZoom()).toBe(3);
    sc.zoomTo(0);
    expect(sc.getZoom()).toBe(1);
    sc.destroy();
  });
});

describe('createScrollContainer — destroy', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('removes renderer.domElement from root', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
    });
    expect(root.children.length).toBeGreaterThan(0);
    sc.destroy();
    expect(root.children.length).toBe(0);
  });

  it('restores panel display style', () => {
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      overscan: 0,
    });
    expect(panels[2]!.style.display).toBe('none');
    sc.destroy();
    expect(panels[2]!.style.display).toBe('');
  });

  it('is idempotent (second destroy is no-op)', () => {
    const panels = makePanels(2);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
    });
    sc.destroy();
    expect(() => sc.destroy()).not.toThrow();
    // 2차 destroy가 1차 destroy가 복원한 panel display 상태를 재변형하지 않는다 (B-22)
    for (const panel of panels) {
      expect(panel.style.display).toBe('');
    }
  });

  // TC-B13-1: destroy 후 scrollTo 는 완전 no-op — 상태·콜백·DOM 전부 불변
  it('TC-B13-1: scrollTo after destroy is a full no-op (no throw, no callback, no state/DOM change)', () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      onIndexChange,
    });
    sc.destroy();
    expect(() => sc.scrollTo(1)).not.toThrow();
    expect(onIndexChange).toHaveBeenCalledTimes(0);
    expect(sc.getActiveIndex()).toBe(0);
    // destroy 가 복원한 display 상태가 재변형되지 않아야 한다
    for (const panel of panels) {
      expect(panel.style.display).toBe('');
    }
  });

  // TC-B13-2: destroy 후 zoomTo 도 완전 no-op
  it('TC-B13-2: zoomTo after destroy is a full no-op (no throw, no callback, zoom unchanged)', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
      onZoomChange,
    });
    sc.destroy();
    expect(() => sc.zoomTo(2)).not.toThrow();
    expect(onZoomChange).toHaveBeenCalledTimes(0);
    expect(sc.getZoom()).toBe(1);
  });

  // TC-B13-3: 가드가 정상 경로를 깨지 않음 — destroy 전 호출은 그대로 동작
  it('TC-B13-3: guard does not break pre-destroy scrollTo (callback count stays 1)', () => {
    const onIndexChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
      onIndexChange,
    });
    sc.scrollTo(1, { animated: false });
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(sc.getActiveIndex()).toBe(1);
    sc.destroy();
    sc.scrollTo(2);
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(sc.getActiveIndex()).toBe(1);
  });
});

describe('createScrollContainer — validateOptions', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('empty panels array throws WebviewHeadlessError', () => {
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: [],
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('minZoom <= 0 throws WebviewHeadlessError', () => {
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        minZoom: 0,
      }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        minZoom: -1,
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('maxZoom < minZoom throws WebviewHeadlessError', () => {
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        minZoom: 2,
        maxZoom: 1,
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('snapThreshold out of (0, 1] throws WebviewHeadlessError', () => {
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        snapThreshold: 0,
      }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        snapThreshold: 1.5,
      }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        snapThreshold: -0.1,
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('resistance out of [0, 1] throws WebviewHeadlessError', () => {
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        resistance: -0.1,
      }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(2),
        resistance: 1.5,
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('valid edge values do not throw', () => {
    const sc1 = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      snapThreshold: 1,
      resistance: 0,
    });
    sc1.destroy();
    const sc2 = createScrollContainer(makeRoot(), {
      direction: 'horizontal',
      panels: makePanels(2),
      snapThreshold: 0.5,
      resistance: 1,
    });
    sc2.destroy();
  });
});

describe('createScrollContainer — panelWidth · gap · align', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot(); // 400 × 600
  });
  afterEach(() => {
    root.remove();
  });

  /** root > domElement > scene */
  function sceneTransform(): string {
    const scene = root.firstElementChild?.firstElementChild as HTMLElement | null | undefined;
    return scene?.style.transform ?? '';
  }

  it('panelWidth 0.8 + gap 16 → 폭 320px 인라인 지정, 중심 x = 0 · 336 · 672, destroy 시 원래 폭으로', () => {
    const panels = makePanels(3);
    panels[1]?.style.setProperty('width', '100%');
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      panelWidth: 0.8,
      gap: 16,
      overscan: 2,
    });
    expect(panels.map((p) => p.style.width)).toEqual(['320px', '320px', '320px']);
    expect(panels[1]?.style.transform).toContain('translate(336px, 0px)');
    expect(panels[2]?.style.transform).toContain('translate(672px, 0px)');
    sc.destroy();
    expect(panels.map((p) => p.style.width)).toEqual(['', '100%', '']);
  });

  it('panelWidth 를 주지 않으면 패널 폭을 건드리지 않는다 (앱 CSS 에 맡김)', () => {
    const panels = makePanels(2);
    const sc = createScrollContainer(root, { direction: 'horizontal', panels });
    expect(panels.map((p) => p.style.width)).toEqual(['', '']);
    sc.destroy();
  });

  it('panelWidth px(300)와 함수 — 1 초과는 px, 함수는 패널마다', () => {
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      panelWidth: (i) => (i === 1 ? 300 : 0.5),
      overscan: 2,
    });
    expect(panels.map((p) => p.style.width)).toEqual(['200px', '300px', '200px']);
    // 중심: 0, 0 + 100 + 150 = 250, 250 + 150 + 100 = 500
    expect(panels[1]?.style.transform).toContain('translate(250px, 0px)');
    expect(panels[2]?.style.transform).toContain('translate(500px, 0px)');
    sc.destroy();
  });

  it("align 'start' → 첫 패널 왼쪽이 화면 왼쪽: scene x = 200 − (0 − 160 + 200) = 160", () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
      panelWidth: 0.8,
      align: 'start',
    });
    expect(sceneTransform()).toContain('translate(160px, 300px)');
    sc.scrollTo(1, { animated: false }); // gap 0 → 중심 320, 정착 320 + 40 = 360 → scene x = 200 − 360
    expect(sceneTransform()).toContain('translate(-160px, 300px)');
    sc.destroy();
  });

  it('가상화는 화면에 보이는 패널 + overscan — 폭 40%(160px)면 활성 양옆도 보여 overscan 0 이어도 붙어 있다', () => {
    const panels = makePanels(6);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      panelWidth: 0.4,
      overscan: 0,
      initialIndex: 2,
    });
    // 활성 2 (중심 320), 화면 [120, 520] → 패널 1 [80, 240] · 2 · 3 [400, 560] 이 겹친다
    const shown = panels.map((p) => p.parentNode !== null && p.style.display !== 'none');
    expect(shown).toEqual([false, true, true, true, false, false]);
    sc.destroy();
  });

  it('전폭 패널의 가상화는 이전과 같다 — overscan 0 이면 활성 하나만', () => {
    const panels = makePanels(4);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      overscan: 0,
      initialIndex: 1,
    });
    const shown = panels.map((p) => p.parentNode !== null && p.style.display !== 'none');
    expect(shown).toEqual([false, true, false, false]);
    sc.destroy();
  });

  it('세로 gap — panelHeight 300, gap 20 → 패널 1 중심 y = −(300 + 20 + 150) = −470', () => {
    const panels = makePanels(2);
    const sc = createScrollContainer(root, {
      direction: 'vertical',
      panels,
      panelHeight: () => 300,
      gap: 20,
      overscan: 1,
    });
    expect(panels[1]?.style.transform).toContain('translate(0px, 470px)');
    sc.destroy();
  });

  it('잘못된 값은 WebviewHeadlessError — panelWidth 0·음수·NaN, 함수가 0 을 반환, gap 음수', () => {
    const bad: Array<Partial<Parameters<typeof createScrollContainer>[1]>> = [
      { panelWidth: 0 },
      { panelWidth: -1 },
      { panelWidth: Number.NaN },
      { panelWidth: () => 0 },
      { gap: -1 },
      { gap: Number.POSITIVE_INFINITY },
    ];
    for (const extra of bad) {
      expect(() =>
        createScrollContainer(root, { direction: 'horizontal', panels: makePanels(2), ...extra }),
      ).toThrow(WebviewHeadlessError);
    }
  });

  it('panelWidth 함수가 잘못된 값을 주면 DOM 을 바꾸기 전에 throw 한다 — root·패널이 그대로 남는다', () => {
    const holder = document.createElement('div');
    const panels = makePanels(2);
    for (const p of panels) holder.appendChild(p);
    expect(() =>
      createScrollContainer(root, { direction: 'horizontal', panels, panelWidth: () => -1 }),
    ).toThrow(WebviewHeadlessError);
    expect(root.childElementCount).toBe(0);
    expect(panels.every((p) => p.parentElement === holder)).toBe(true);
  });
});

describe('createScrollContainer — dragThreshold', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  function pointer(type: string, x: number, y: number): void {
    root.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }),
    );
  }

  /** root > domElement > scene — 카메라 transform 이 기록되는 노드 (integration 테스트와 같은 경로). */
  function sceneTransform(): string {
    const scene = root.firstElementChild?.firstElementChild as HTMLElement | null | undefined;
    return scene?.style.transform ?? '';
  }

  it('음수·NaN·Infinity 는 WebviewHeadlessError', () => {
    for (const dragThreshold of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createScrollContainer(root, {
          direction: 'horizontal',
          panels: makePanels(2),
          dragThreshold,
        }),
      ).toThrow(WebviewHeadlessError);
    }
  });

  it('기본값 10 — 8px 드래그는 scene 을 움직이지 않고, 30px 드래그는 20px 만 움직인다 (여유만큼 당겨 잡음)', () => {
    const sc = createScrollContainer(root, { direction: 'horizontal', panels: makePanels(2) });
    const t0 = sceneTransform();
    pointer('pointerdown', 300, 300);
    pointer('pointermove', 292, 300);
    expect(sceneTransform()).toBe(t0);
    pointer('pointermove', 270, 300);
    // root 400 → scene translate x = 200 − cameraX; cameraX 20
    expect(sceneTransform()).toContain('translate(180px');
    sc.destroy();
  });

  it('dragThreshold: 0 → 첫 move 부터 따라간다', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      dragThreshold: 0,
    });
    pointer('pointerdown', 300, 300);
    pointer('pointermove', 292, 300);
    expect(sceneTransform()).toContain('translate(192px');
    sc.destroy();
  });
});

describe('createScrollContainer — doubleTapZoom', () => {
  let root: HTMLElement;
  let now: number;
  beforeEach(() => {
    root = makeRoot();
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    root.remove();
  });

  function tap(x: number, y: number): void {
    root.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: x, clientY: y, bubbles: true }),
    );
    now += 50;
    root.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y, bubbles: true }),
    );
  }

  it('doubleTapZoom ≤ minZoom, > maxZoom, NaN 은 WebviewHeadlessError', () => {
    for (const doubleTapZoom of [1, 0.5, 4, Number.NaN]) {
      expect(() =>
        createScrollContainer(root, {
          direction: 'horizontal',
          panels: makePanels(2),
          minZoom: 1,
          maxZoom: 3,
          doubleTapZoom,
        }),
      ).toThrow(WebviewHeadlessError);
    }
  });

  it('doubleTapZoom: false 와 생략은 허용', () => {
    const a = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      doubleTapZoom: false,
    });
    a.destroy();
    const b = createScrollContainer(root, { direction: 'horizontal', panels: makePanels(2) });
    b.destroy();
  });

  it('더블탭 → onZoomChange(doubleTapZoom) + getZoom() 갱신, 다시 더블탭 → minZoom', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      doubleTapZoom: 2,
      onZoomChange,
    });
    tap(300, 300);
    now += 100;
    tap(300, 300);
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange).toHaveBeenLastCalledWith(2);
    expect(sc.getZoom()).toBe(2);
    now += 500;
    tap(300, 300);
    now += 100;
    tap(300, 300);
    expect(onZoomChange).toHaveBeenLastCalledWith(1);
    expect(sc.getZoom()).toBe(1);
    sc.destroy();
  });

  it('기본값(비활성)에서는 연속 탭에도 줌이 바뀌지 않는다', () => {
    const onZoomChange = vi.fn();
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(2),
      onZoomChange,
    });
    tap(300, 300);
    now += 100;
    tap(300, 300);
    expect(onZoomChange).not.toHaveBeenCalled();
    expect(sc.getZoom()).toBe(1);
    sc.destroy();
  });
});

describe('createScrollContainer — direction', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('vertical direction accepted; panel display virtualization still works', () => {
    const panels = makePanels(5);
    const sc = createScrollContainer(root, {
      direction: 'vertical',
      panels,
      overscan: 0,
      initialIndex: 0,
    });
    expect(panels[0]!.style.display).toBe('');
    expect(panels[1]!.style.display).toBe('none');
    sc.scrollTo(2);
    expect(panels[2]!.style.display).toBe('');
    expect(panels[0]!.style.display).toBe('none');
    sc.destroy();
  });

  it("'both' direction (사용 중단) — horizontal 과 같게 동작하고 오류가 없다", () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(3);
    const sc = createScrollContainer(root, { direction: 'both', panels, onIndexChange });
    // 가로 배치 — 패널 1 은 오른쪽(x = 400)에 놓인다 (세로라면 translate(0px, …))
    expect(panels[1]!.style.transform).toContain('translate(400px, 0px)');
    // 가로 키보드 — 오른쪽 화살표가 다음 패널로 간다
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(sc.getActiveIndex()).toBe(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(() => sc.scrollTo(2)).not.toThrow();
    expect(sc.getActiveIndex()).toBe(2);
    sc.destroy();
  });
});
