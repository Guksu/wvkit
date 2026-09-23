import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PanCamera, createCamera } from '../camera';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl 줌 상태(zoom > 1) pan 계약 단위 테스트.
 *
 * 배경: 핀치 줌 뒤 손을 떼면 카메라가 항상 패널 중심으로 되돌아가고, 첫/끝 패널의 가장자리는
 * 줌 상태에서 절대 볼 수 없었다 (릴리스가 무조건 `animateToIndex`, 경계가 패널 중심 사이로 고정).
 *
 * 새 계약:
 *  - 경계: 첫/끝 패널의 줌 반폭(`zoomedHalfExtent`)만큼 바깥으로 넓어진다
 *  - 릴리스: 패널 범위 안이면 그 자리 유지, 저항 구간이면 가장자리 복귀, gap이면 방향·속도로 앞/뒤 가장자리 스냅
 *  - 릴리스 트윈은 컨트롤이 직접 시작하고 그 다음 `onPanRelease(index)`를 낸다
 *  - `animateToZoom`은 새 줌 기준 패널 범위 밖이면 가장자리(zoom ≤ 1이면 중심)로 끌어온다
 *
 * 수동 RAF 큐 + performance.now 스파이로 트윈 종착점을 프레임 단위로 확인한다 (tween 테스트와 같은 패턴).
 * 공통 상수: rootSize 400×600, zoom 2 → 가로 반폭 100 / 세로 반폭 150, snapThreshold 0.3, resistance 0.2.
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

const VERTICAL_POSITIONS = [
  { x: 0, y: -300 },
  { x: 0, y: -900 },
  { x: 0, y: -1500 },
  { x: 0, y: -2100 },
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

describe('createCameraControl — 줌 상태 pan (위치 유지 · 가장자리 · gap 스냅)', () => {
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

  /** 트윈 종료까지 시간을 넘긴 뒤 잔여 프레임 전부 실행 (릴리스 트윈 최대 800ms, 프로그램 트윈 300ms). */
  function settle(): void {
    now += 900;
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
  }

  function makeControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    const onPanRelease = vi.fn();
    const onPinchRelease = vi.fn();
    const onChange = vi.fn();
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
      onChange,
      onPanRelease,
      onPinchRelease,
      ...extra,
    });
    return { control, onPanRelease, onPinchRelease, onChange };
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

  it('Z1: zoom 2에서 첫 패널 왼쪽 가장자리까지 pan 가능 — 경계가 −100까지 넓어져 저항 없음', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now += 16;
    move(1, 400, 300); // dx=+200 → raw x = 0 − 200/2 = −100 = 경계 (zoom 1이었으면 −20으로 감쇠)
    expect(camera.position.x).toBe(-100);
    now += 16;
    move(1, 450, 300); // dx=+250 → raw −125 < −100 → 저항: −100 − 25×0.2 = −105
    expect(camera.position.x).toBeCloseTo(-105, 10);
    control.destroy();
  });

  it('Z2: zoom 2에서 패널 범위 안 작은 pan → 릴리스 후 그 자리 유지 (중심 복귀 없음), onPanRelease(0)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now += 16;
    move(1, 140, 300); // dx=−60 → x = 30 (범위 [−100,100] 안)
    now += 200;
    move(1, 140, 300); // 멈춤 (lastDelta 0 → 관성 없음)
    now += 16;
    up(1, 140, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    expect(rafQueue.size).toBe(0); // 목표 = 현재 → 트윈 자체를 시작하지 않음
    settle();
    expect(camera.position.x).toBe(30);
    expect(camera.zoom).toBe(2);
    control.destroy();
  });

  it('Z3: zoom 2에서 저항 구간까지 끌고 릴리스 → 패널 가장자리(−100)로 복귀 트윈', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now += 16;
    move(1, 500, 300); // raw −150 → 저항 −110
    now += 16;
    up(1, 500, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    settle();
    expect(camera.position.x).toBe(-100);
    control.destroy();
  });

  it('Z4: zoom 2에서 gap을 threshold 넘게 건너 정지 릴리스 → 다음 패널의 가까운 가장자리(300)로 스냅, onPanRelease(1)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 300, 300);
    now += 100;
    move(1, 100, 300); // dx=−200 → x=100 (패널 0 가장자리)
    now += 100;
    move(1, -60, 300); // dx=−360 → x=180 → gap [100,300] 진행 비율 0.4 > 0.3
    now += 1000; // 멈춘 채 한참 뒤 릴리스 → 속도 ≈ 0 (관성 투영 없음)
    up(1, -60, 300);
    expect(onPanRelease).toHaveBeenCalledWith(1);
    settle();
    expect(camera.position.x).toBe(300);
    expect(camera.zoom).toBe(2);
    control.destroy();
  });

  it('Z5: zoom 2에서 gap을 조금만 건너 정지 릴리스 → 출발 패널 가장자리(100)로 복귀, onPanRelease(0)', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(1, 300, 300);
    now += 100;
    move(1, 100, 300); // x=100
    now += 100;
    move(1, 20, 300); // dx=−280 → x=140 → gap 진행 비율 0.2 < 0.3
    now += 1000; // 정지 릴리스
    up(1, 20, 300);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    settle();
    expect(camera.position.x).toBe(100);
    control.destroy();
  });

  it('Z6: 핀치 줌(중점이 중심에서 벗어남) 후 두 손가락 모두 떼도 앵커 보정된 위치가 유지된다', () => {
    const { control, onPanRelease, onPinchRelease } = makeControl();
    control.animateToIndex(0, false);
    down(1, 240, 300);
    down(2, 320, 300); // dist 80, mid (280,300) → worldAnchor.x = 80
    move(1, 200, 300);
    move(2, 360, 300); // dist 160 → zoom 2, mid 유지 → camera x = 80 − 80/2 = 40 (범위 [−100,100] 안)
    expect(camera.zoom).toBe(2);
    expect(camera.position.x).toBe(40);
    now += 16;
    up(1, 200, 300); // pinch 종료 → 남은 손가락 pan 승계
    now += 16;
    up(2, 360, 300); // pan 종료 → 줌 상태 릴리스: 범위 안 → 유지
    expect(onPinchRelease).toHaveBeenCalledWith(2);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    settle();
    expect(camera.position.x).toBe(40); // 기존 동작(0으로 복귀)이면 실패
    control.destroy();
  });

  it('Z7: animateToZoom(1)로 줌아웃하면 가장자리에 있던 카메라가 패널 중심으로 돌아온다', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    camera.position.x = 100; // 패널 0 오른쪽 가장자리
    control.animateToZoom(1, false);
    expect(camera.zoom).toBe(1);
    expect(camera.position.x).toBe(0);
    // animated 경로도 종착점이 중심
    control.animateToZoom(2, false);
    camera.position.x = -100;
    control.animateToZoom(1, true);
    settle();
    expect(camera.zoom).toBe(1);
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('Z8: animateToZoom으로 줌을 낮추면 새 줌의 반폭 안으로만 끌어온다 (2→1.5: 반폭 100→66.7)', () => {
    const { control } = makeControl();
    control.animateToIndex(1, false); // x=400
    control.animateToZoom(2, false);
    camera.position.x = 500; // 패널 1 오른쪽 가장자리 (400+100)
    control.animateToZoom(1.5, false);
    // 반폭 = 200 × (1 − 1/1.5) = 66.67 → 400 + 66.67
    expect(camera.position.x).toBeCloseTo(400 + 200 * (1 - 1 / 1.5), 10);
    control.destroy();
  });

  it('Z9: zoom 1 릴리스는 기존 계약 — 패널 중심 스냅 트윈을 컨트롤이 직접 시작한다', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(1, 300, 300);
    now += 100;
    move(1, 100, 300); // x=200 → dragRatio 0.5 > 0.3
    now += 100;
    up(1, 100, 300);
    expect(onPanRelease).toHaveBeenCalledWith(1);
    expect(rafQueue.size).toBe(1); // 컨트롤이 스냅 트윈을 이미 시작
    settle();
    expect(camera.position.x).toBe(400);
    control.destroy();
  });

  it('Z10: vertical zoom 2 — 패널 위쪽 가장자리(−150)까지 pan 후 릴리스해도 그 자리 유지', () => {
    const { control, onPanRelease } = makeControl({
      direction: 'vertical',
      positions: VERTICAL_POSITIONS,
    });
    control.animateToIndex(0, false); // y=−300
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now += 16;
    move(1, 200, 500); // dy=+200 → y = −300 + 200/2 = −200 (범위 [−450,−150] 안)
    expect(camera.position.y).toBe(-200);
    now += 200;
    move(1, 200, 500); // 멈춤 → 관성 없음
    now += 16;
    up(1, 200, 500);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    settle();
    expect(camera.position.y).toBe(-200);
    control.destroy();
  });

  it('Z11: vertical zoom 2 — 아래쪽 gap을 threshold 넘게 건너면 다음 패널 위 가장자리(−750)로 스냅', () => {
    const { control, onPanRelease } = makeControl({
      direction: 'vertical',
      positions: VERTICAL_POSITIONS,
    });
    control.animateToIndex(0, false); // y=−300, 패널0 범위 [−450,−150], 패널1 범위 [−1050,−750]
    control.animateToZoom(2, false);
    down(1, 200, 500);
    now += 100;
    move(1, 200, 200); // dy=−300 → y = −450 (패널 0 아래 가장자리)
    now += 100;
    move(1, 200, -40); // dy=−540 → y = −570 → gap [−450,−750] 진행 비율 120/300 = 0.4 > 0.3
    now += 200;
    move(1, 200, -40); // 멈춤 → 관성 없음 (정지 릴리스의 gap 판정)
    now += 16;
    up(1, 200, -40);
    expect(onPanRelease).toHaveBeenCalledWith(1);
    settle();
    expect(camera.position.y).toBe(-750);
    control.destroy();
  });

  it('Z12: panelSizes로 패널별 크기를 주면 그 크기로 반폭을 계산한다 (세로 800px 패널, zoom 2 → 반폭 200)', () => {
    const positions = [
      { x: 0, y: -400 },
      { x: 0, y: -1200 },
    ];
    const { control } = makeControl({
      direction: 'vertical',
      positions,
      panelSizes: [800, 800],
    });
    control.animateToIndex(0, false); // y=−400
    control.animateToZoom(2, false);
    down(1, 200, 300);
    now += 16;
    move(1, 200, 700); // dy=+400 → raw y = −400 + 200 = −200 = 경계(−400+200) → 저항 없음
    expect(camera.position.y).toBe(-200);
    control.destroy();
  });
});
