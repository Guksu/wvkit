import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PanCamera, createCamera } from '../camera';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl — 화면보다 좁은 패널(피킹)·간격·정렬.
 *
 * 레이아웃: root 400×600, 패널 폭 320, gap 16 → 패널 중심 x = 0 / 336 / 672.
 * - center 정렬: 정착 위치 = 패널 중심. start 정렬: 패널 왼쪽이 화면 왼쪽 → 중심 − 160 + 200 = 중심 + 40.
 * - 드래그 비율 분모 = 이웃 패널까지 정착 위치 간격(336). 전폭이었다면 화면 폭(400).
 * - zoom 2: 보이는 폭 200 < 320 → pan 범위 중심 ± 60 (전폭 공식 (320/2)(1 − 1/2) = 80 이 아니다).
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

const PEEK_POSITIONS = [
  { x: 0, y: 0 },
  { x: 336, y: 0 },
  { x: 672, y: 0 },
];
const PEEK_SIZES = [320, 320, 320];

function pointerEvent(
  type: string,
  init: { pointerId: number; clientX: number; clientY: number },
): Event {
  return new PointerEvent(type, { ...init, bubbles: true });
}

describe('createCameraControl — 좁은 패널 · 간격 · 정렬', () => {
  let root: HTMLElement;
  let camera: PanCamera;
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafIdSeq: number;
  let now: number;

  function flushAll(): void {
    now += 900;
    for (let i = 0; i < 20; i++) {
      const first = rafQueue.entries().next();
      if (first.done) break;
      const [id, cb] = first.value;
      rafQueue.delete(id);
      cb(now);
    }
  }

  function makeControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    const onPanRelease = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: PEEK_POSITIONS,
      panelSizes: PEEK_SIZES,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease,
      onPinchRelease: vi.fn(),
      ...extra,
    });
    return { control, onPanRelease };
  }

  const down = (x: number, y = 300) =>
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: x, clientY: y }));
  const move = (x: number, y = 300) =>
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y }));
  const up = (x: number, y = 300) =>
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y }));

  beforeEach(() => {
    root = makeRoot();
    camera = createCamera();
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
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    root.remove();
  });

  it('W1: center 정렬 — animateToIndex 는 패널 중심(0 · 336 · 672)으로', () => {
    const { control } = makeControl();
    control.animateToIndex(1, false);
    expect(camera.position.x).toBe(336);
    control.animateToIndex(2, false);
    expect(camera.position.x).toBe(672);
    control.destroy();
  });

  it('W2: start 정렬 — 패널 왼쪽이 화면 왼쪽에 붙는 위치 (중심 + 40)', () => {
    const { control } = makeControl({ align: 'start' });
    control.animateToIndex(0, false);
    expect(camera.position.x).toBe(40);
    control.animateToIndex(1, false);
    expect(camera.position.x).toBe(376);
    // 화면 x of 패널 1 왼쪽(336 − 160 = 176) = (176 − 376) + 200 = 0
    expect(176 - camera.position.x + 200).toBe(0);
    control.destroy();
  });

  it('W3: 드래그 비율 분모는 이웃까지 정착 간격(336) — 110px 은 넘기고(0.33) 95px 은 되돌아온다(0.28)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(300);
    now += 200;
    move(190); // x = 110
    now += 200;
    move(190); // 멈춤 — 속도 0
    now += 16;
    up(190);
    expect(onPanRelease).toHaveBeenLastCalledWith(1); // 전폭 분모(400)였다면 0.275 → 0
    flushAll();
    expect(camera.position.x).toBe(336);
    down(300);
    now += 200;
    move(395); // x = 336 − 95 = 241 → 되돌아가는 방향 비율 0.28
    now += 200;
    move(395);
    now += 16;
    up(395);
    expect(onPanRelease).toHaveBeenLastCalledWith(1);
    flushAll();
    expect(camera.position.x).toBe(336);
    control.destroy();
  });

  it('W4: zoom 2 에서 좁은 패널의 pan 범위는 중심 ± 60 (보이는 폭 200 기준)', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    control.panBy(1000, 0);
    expect(camera.position.x).toBe(60);
    control.panBy(-5000, 0);
    expect(camera.position.x).toBe(-60);
    control.destroy();
  });

  it('W5: start 정렬 — zoomTo 는 화면 중심을 고정(범위 안이면 그 자리), 그 뒤 scrollTo 는 패널 왼쪽 끝(−60)에 정착', () => {
    const { control } = makeControl({ align: 'start' });
    control.animateToIndex(0, false); // 40
    control.animateToZoom(2, false);
    expect(camera.position.x).toBe(40); // [−60, 60] 안 → 그대로 (center 정렬의 zoomTo 와 같은 규칙)
    control.animateToIndex(0, false);
    expect(camera.position.x).toBe(-60);
    // 패널 왼쪽(−160)이 화면 0: (−160 − (−60)) × 2 + 200 = 0
    expect((-160 - camera.position.x) * 2 + 200).toBe(0);
    control.destroy();
  });

  it('W6: 현재 패널 판정은 정착 위치 기준 — start 정렬에서 패널 1 근처(305)는 패널 1 (중심 거리로는 패널 2)', () => {
    const positions = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 400, y: 0 },
    ];
    const { control } = makeControl({ align: 'start', positions, panelSizes: [200, 200, 200] });
    control.animateToIndex(1, false);
    expect(camera.position.x).toBe(300); // 200 − 100 + 200
    camera.position.x = 305;
    control.animateToZoom(1, false); // 현재 패널 범위로 클램프
    expect(camera.position.x).toBe(300); // 중심 거리로 골랐다면 패널 2 → 500
    control.destroy();
  });
});
