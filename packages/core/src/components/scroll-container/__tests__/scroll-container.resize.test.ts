import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScrollContainer } from '../scroll-container';

/**
 * ScrollContainer ResizeObserver 보정 경로 단위 테스트 (B-17 / T-03).
 *
 * RO stub(수동 발화)으로 scroll-container.ts의 RO 블록(destroyed 가드 → 동일 크기
 * 조기 리턴 → frustum/renderer/패널 좌표 재계산 → 트윈 취소 + 즉시 보정)을 검증한다.
 * 렌더는 동기(requestRender가 renderer.render 직접 호출)이므로 DOM style/transform으로 관측.
 * RO/RAF stub이 다른 파일에 새지 않도록 별도 파일.
 */

type ROCallback = () => void;

class MockRO {
  static instances: MockRO[] = [];
  callback: ROCallback;
  observed: Element[] = [];
  disconnect = vi.fn();
  constructor(cb: ROCallback) {
    this.callback = cb;
    MockRO.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  trigger(): void {
    this.callback();
  }
}

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

function setRootSize(root: HTMLElement, width: number, height: number): void {
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
}

/** root.firstChild = CSS3DRenderer.domElement (setSize가 width/height px 문자열 기록). */
function rendererEl(root: HTMLElement): HTMLElement {
  return root.firstChild as HTMLElement;
}

/** domElement > viewElement > cameraElement — 카메라 행렬이 transform으로 기록되는 노드. */
function cameraEl(root: HTMLElement): HTMLElement {
  return rendererEl(root).firstChild!.firstChild as HTMLElement;
}

interface DomSnapshot {
  width: string;
  height: string;
  scene: string;
  panels: string[];
}

function snapshot(root: HTMLElement, panels: HTMLElement[]): DomSnapshot {
  const r = rendererEl(root);
  return {
    width: r.style.width,
    height: r.style.height,
    scene: cameraEl(root).style.transform,
    panels: panels.map((p) => p.style.transform),
  };
}

describe('createScrollContainer — ResizeObserver 보정', () => {
  let root: HTMLElement;

  // --- 수동 RAF 큐 (R6에서 트윈 진행 상태 제어) ---
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafIdSeq: number;

  function flushAllFrames(): void {
    for (let i = 0; i < 20; i++) {
      const first = rafQueue.entries().next();
      if (first.done) return;
      const [id, cb] = first.value;
      rafQueue.delete(id);
      cb(performance.now());
    }
  }

  beforeEach(() => {
    MockRO.instances = [];
    // createScrollContainer 호출 전에 stub 설치 필수 — 생성 시점에 typeof 분기.
    vi.stubGlobal('ResizeObserver', MockRO);
    rafQueue = new Map();
    rafIdSeq = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafIdSeq += 1;
      rafQueue.set(rafIdSeq, cb);
      return rafIdSeq;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafQueue.delete(id);
    });
    root = makeRoot();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    root.remove();
  });

  it('resize — R1: root를 observe하고 destroy 시 disconnect를 1회 호출한다', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
    });
    expect(MockRO.instances).toHaveLength(1);
    const ro = MockRO.instances[0]!;
    expect(ro.observed).toContain(root);
    expect(ro.disconnect).not.toHaveBeenCalled();

    sc.destroy();
    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('resize — R2: 리사이즈 콜백이 renderer 사이즈를 갱신한다 (setSize px 문자열)', () => {
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels: makePanels(3),
    });
    expect(rendererEl(root).style.width).toBe('400px');
    expect(rendererEl(root).style.height).toBe('600px');

    setRootSize(root, 800, 500);
    MockRO.instances[0]!.trigger();

    expect(rendererEl(root).style.width).toBe('800px');
    expect(rendererEl(root).style.height).toBe('500px');
    sc.destroy();
  });

  it('resize — R3: 리사이즈 시 패널 좌표·카메라가 재계산된다 (인덱스 불변, onIndexChange 미발화)', () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
      onIndexChange,
    });
    const before = snapshot(root, panels);

    setRootSize(root, 800, 600);
    MockRO.instances[0]!.trigger();

    const after = snapshot(root, panels);
    // computePositions 반영: 활성 패널(x 400→800)과 scene(카메라 x 400→800)의 transform 변경
    expect(after.panels[1]).not.toBe(before.panels[1]);
    expect(after.scene).not.toBe(before.scene);
    expect(sc.getActiveIndex()).toBe(1);
    expect(onIndexChange).not.toHaveBeenCalled();
    sc.destroy();
  });

  it('resize — R4: 동일 크기 콜백은 조기 리턴 — DOM 스냅샷 불변', () => {
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
    });
    const before = snapshot(root, panels);

    // 크기 변경 없이 발화 (RO는 observe 직후 등 실제로도 스퓨리어스 콜백 가능)
    MockRO.instances[0]!.trigger();

    expect(snapshot(root, panels)).toEqual(before);
    sc.destroy();
  });

  it('resize — R5: destroy 후 콜백은 no-op (throw 없음, DOM 불변)', () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 1,
      onIndexChange,
    });
    const rendered = rendererEl(root); // destroy가 detach하므로 참조 유지
    const ro = MockRO.instances[0]!;
    sc.destroy();
    onIndexChange.mockClear(); // 마운트 중 발화분 제외 — destroy 이후만 관찰

    const panelTransformsBefore = panels.map((p) => p.style.transform);
    setRootSize(root, 800, 500);
    expect(() => ro.trigger()).not.toThrow();

    // destroyed 가드로 setSize/렌더 미수행 — 스타일·transform 불변, 콜백 미발화 (B-22)
    expect(rendered.style.width).toBe('400px');
    expect(rendered.style.height).toBe('600px');
    expect(panels.map((p) => p.style.transform)).toEqual(panelTransformsBefore);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('resize — R6: 진행 중 트윈을 취소하고 새 좌표 기준 최종 위치로 즉시 보정한다', () => {
    const panels = makePanels(3);
    const sc = createScrollContainer(root, {
      direction: 'horizontal',
      panels,
      initialIndex: 0,
    });
    const before = snapshot(root, panels);

    // 트윈 시작 (RAF stub — 아직 한 프레임도 진행 안 됨)
    sc.scrollTo(1, { animated: true });
    expect(rafQueue.size).toBe(1);
    // 트윈 미진행이므로 scene transform은 아직 그대로
    expect(snapshot(root, panels).scene).toBe(before.scene);

    setRootSize(root, 800, 500);
    MockRO.instances[0]!.trigger();

    // RAF flush 없이 이미 새 좌표 기준으로 렌더됨 (cancelAnimation + applyActiveIndexToCameraDirectly)
    const afterResize = snapshot(root, panels);
    expect(afterResize.scene).not.toBe(before.scene);
    expect(afterResize.width).toBe('800px');

    // 잔여 RAF flush에도 불변 — 트윈이 취소됐음을 증명
    flushAllFrames();
    expect(snapshot(root, panels)).toEqual(afterResize);

    // 교차검증: 동일 인덱스로의 non-animated 점프(정의상 최종 위치)와 동일한 DOM 결과
    sc.scrollTo(1, { animated: false });
    expect(snapshot(root, panels)).toEqual(afterResize);

    expect(sc.getActiveIndex()).toBe(1);
    sc.destroy();
  });
});
