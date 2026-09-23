import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PanCamera, createCamera } from '../camera';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl 관성(릴리스 속도 반영) 단위 테스트.
 *
 * 계약:
 *  - 릴리스 트윈 시간 = snapDurationMs(distance, velocityToward, panelSize, 120, 400) — 페이저
 *    (줌 상태 자유 pan은 상한 800). easeOutCubic 초기 기울기 3 → duration = 3·d/v 로 손가락 속도에 이어진다.
 *  - 목표 반대 방향 속도(엣지 저항 복귀)는 무시 → 거리 비례 상한.
 *  - 줌 상태: 놓은 위치가 패널 범위 안이면 projectInertia(s, v) = s + 500·v 를 그 패널 가장자리 안으로
 *    잘라 감속 — 관성만으로는 다음 패널로 넘어가지 않는다. 놓은 위치가 gap·저항 구간이면
 *    resolveZoomedRelease(속도 가중 포함) 가 스냅을 정한다.
 *  - 프로그램 호출(animateToIndex)은 고정 300ms 그대로.
 *
 * 수동 RAF 큐 + performance.now 스파이. rootSize 400×600, snapThreshold 0.3, resistance 0.2.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

function makeCamera(): PanCamera {
  return createCamera();
}

const HORIZONTAL_POSITIONS = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 800, y: 0 },
  { x: 1200, y: 0 },
];

function pointerEvent(
  type: string,
  init: { pointerId: number; clientX: number; clientY: number },
): Event {
  try {
    return new PointerEvent(type, { ...init, bubbles: true });
  } catch {
    const ev = new Event(type, { bubbles: true });
    Object.assign(ev, init);
    return ev;
  }
}

describe('createCameraControl — 관성 (릴리스 속도 → 트윈 시간·투영)', () => {
  let root: HTMLElement;
  let camera: PanCamera;
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafIdSeq: number;
  let now: number;

  function flushFrame(): boolean {
    const first = rafQueue.entries().next();
    if (first.done) return false;
    const [id, cb] = first.value;
    rafQueue.delete(id);
    cb(now);
    return true;
  }

  function makeControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    const onPanRelease = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
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

  const down = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: id, clientX: x, clientY: y }));
  const move = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y }));
  const up = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: id, clientX: x, clientY: y }));

  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
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

  it('I1: 빠른 플릭 → 다음 패널, 트윈 시간은 3·d/v 로 짧아진다 (255ms)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(1, 200, 300); // t=1000
    now = 1100;
    move(1, 180, 300); // x=20
    now = 1110;
    move(1, 140, 300); // x=60, lastDelta=40, interval=10
    now = 1111;
    up(1, 140, 300); // dt = max(1,10,1) = 10 → v = 4/ms, dragRatio 0.15 + velocityRatio(1.0)×0.3 → 전진
    expect(onPanRelease).toHaveBeenCalledWith(1);
    // distance 340, cap = 120 + (340/400)×280 = 358, 3·340/4 = 255 → 255ms
    now = 1111 + 127.5; // t = 0.5 → k = 0.875
    flushFrame();
    expect(camera.position.x).toBeCloseTo(60 + 340 * 0.875, 6);
    now = 1111 + 255;
    flushFrame();
    expect(camera.position.x).toBe(400);
    expect(rafQueue.size).toBe(0); // 종료 — 추가 프레임 없음
    control.destroy();
  });

  it('I2: 느린 릴리스(정지 후 놓기) → 거리 비례 상한 (240px → 288ms), 200ms 시점엔 아직 미도달', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(1, 300, 300);
    now = 1100;
    move(1, 220, 300); // x=80
    now = 1200;
    move(1, 140, 300); // x=160 (dragRatio 0.4)
    now = 1400;
    move(1, 140, 300); // 멈춤 → lastDelta 0
    now = 1416;
    up(1, 140, 300);
    expect(onPanRelease).toHaveBeenCalledWith(1);
    // distance 240 → cap = 120 + 0.6×280 = 288
    now = 1416 + 200;
    flushFrame();
    expect(camera.position.x).toBeLessThan(400);
    now = 1416 + 288;
    flushFrame();
    expect(camera.position.x).toBe(400);
    control.destroy();
  });

  it('I3: 엣지 저항 구간에서 바깥 방향 속도로 놓아도 복귀 시간은 거리 비례 상한 (20px → 134ms)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(1, 200, 300);
    now = 1016;
    move(1, 300, 300); // dx=+100 → raw −100 → 저항 −20, lastDelta −20 (목표 0 과 반대 방향)
    now = 1017;
    up(1, 300, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    now = 1017 + 100;
    flushFrame();
    expect(camera.position.x).toBeLessThan(0); // 134ms 전엔 아직 복귀 중
    now = 1017 + 134;
    flushFrame();
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('I4: zoom 2 부드러운 플릭 → 투영 위치(s + 500v)까지 감속해 패널 범위 안에 멈춘다', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now = 1016;
    move(1, 180, 300); // x = 10
    now = 1032;
    move(1, 176, 300); // dx 누적 −24 → x = 12, lastDelta = 2, dt 16 → v = 0.125/ms
    now = 1033;
    up(1, 176, 300);
    // 투영: 12 + 500×0.125 = 74.5 (패널 0 범위 [−100,100] 안) → 그 자리까지 감속
    expect(onPanRelease).toHaveBeenCalledWith(0);
    now += 900;
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
    expect(camera.position.x).toBeCloseTo(74.5, 6);
    expect(camera.zoom).toBe(2);
    control.destroy();
  });

  it('I5: zoom 2 강한 플릭이라도 놓은 위치가 패널 안이면 가장자리(100)에서 멈춘다 — 관성만으로 페이지 전환 없음', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now = 1016;
    move(1, 140, 300); // x = 30
    now = 1032;
    move(1, 80, 300); // x = 60 (범위 [−100,100] 안), lastDelta = 30, dt 16 → v ≈ 1.9/ms → 투영 ≈ 997 → 가장자리 100 으로 클램프
    now = 1033;
    up(1, 80, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0); // 다음 패널로 넘어가지 않는다
    now += 900;
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
    expect(camera.position.x).toBe(100); // 패널 0 의 가장자리에서 멈춤
    expect(camera.zoom).toBe(2);
    control.destroy();
  });

  it('I7: zoom 2 에서 놓은 위치가 gap 이면 속도 가중을 포함한 gap 판정으로 스냅 (관성 투영 아님)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 300, 300);
    now = 1100;
    move(1, 100, 300); // x = 100 (가장자리)
    now = 1200;
    move(1, 20, 300); // x = 140 → gap [100,300] 진행 0.2, lastDelta 40, dt 100 → 속도(100ms창) 40 → 40/200 = 0.2 × 0.3 = 0.06 → 0.26 < 0.3
    now = 1201;
    up(1, 20, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    now += 900;
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
    expect(camera.position.x).toBe(100); // 출발 패널 가장자리로 복귀
    control.destroy();
  });

  it('I6: 프로그램 호출(animateToIndex)은 관성과 무관하게 고정 300ms', () => {
    const { control } = makeControl();
    control.animateToIndex(2, true);
    now = 1000 + 150;
    flushFrame();
    expect(camera.position.x).toBeCloseTo(800 * 0.875, 6);
    now = 1000 + 300;
    flushFrame();
    expect(camera.position.x).toBe(800);
    control.destroy();
  });
});
