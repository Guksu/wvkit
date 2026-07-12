import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl `animated=true` RAF 트윈 단위 테스트 (B-17 / T-01).
 *
 * 수동 RAF 큐 + performance.now 스파이로 easeOutCubic 트윈을 프레임 단위로 검증한다.
 * RAF/performance 목킹이 다른 describe에 새지 않도록 `camera-control.test.ts`와 별도 파일.
 *
 * 기대값 도출: easeOutCubic(t) = 1 - (1-t)^3, TWEEN_DURATION_MS = 300.
 *   t=0.5 → k=0.875. x 0→800 트윈이면 t=0.5에서 x=700, zoom 1→2 트윈이면 zoom=1.875.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

function makeCamera(width = 400, height = 600): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    2000,
  );
  cam.position.set(0, 0, 1000);
  return cam;
}

const HORIZONTAL_POSITIONS = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 800, y: 0 },
  { x: 1200, y: 0 },
];

describe('createCameraControl — animated tween (manual RAF queue)', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;

  // --- 수동 RAF 큐 ---
  // cancelAnimationFrame(id)는 해당 콜백을 큐에서 제거한다(실 브라우저 동작과 동일).
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafIdSeq: number;
  let cancelSpy: ReturnType<typeof vi.fn>;

  // --- 시간 제어 ---
  let now: number;

  /** 큐에서 가장 오래된 프레임 1개를 꺼내 실행. 큐가 비었으면 false. */
  function flushFrame(): boolean {
    const first = rafQueue.entries().next();
    if (first.done) return false;
    const [id, cb] = first.value;
    rafQueue.delete(id);
    cb(now);
    return true;
  }

  /** 잔여 큐 전부 flush (안전 상한 20프레임). */
  function flushAll(): void {
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
  }

  function makeControl(
    extra: Partial<Parameters<typeof createCameraControl>[0]> = {},
    cam: THREE.OrthographicCamera = camera,
  ) {
    return createCameraControl({
      root,
      camera: cam,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
      ...extra,
    });
  }

  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
    rafQueue = new Map();
    rafIdSeq = 0;
    cancelSpy = vi.fn((id: number) => {
      rafQueue.delete(id);
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafIdSeq += 1;
      rafQueue.set(rafIdSeq, cb);
      return rafIdSeq;
    });
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);
    // startTween이 시작 시각을 capture하므로 트윈 시작 전에 설치
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    root.remove();
  });

  it('tween — V1: 중간 프레임에서 easeOutCubic 보간 (t=0.5 → x=700) + 프레임당 onChange 1회', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });

    control.animateToIndex(2, true); // x: 0 → 800, start=1000
    expect(onChange).not.toHaveBeenCalled(); // 프레임 실행 전에는 카메라 불변

    now = 1150; // t = 150/300 = 0.5 → k = 0.875
    expect(flushFrame()).toBe(true);

    expect(camera.position.x).toBeCloseTo(700, 6); // 800 * 0.875
    expect(camera.position.y).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(1);

    control.destroy();
  });

  it('tween — V2: 완료 프레임에서 정확 도달 + RAF 중단 (추가 프레임/onChange 없음)', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });

    control.animateToIndex(2, true);
    now = 1150;
    flushFrame(); // t=0.5
    now = 1300; // t=1.0
    flushFrame();

    expect(camera.position.x).toBe(800); // 정확값 (k(1)=1)
    expect(onChange).toHaveBeenCalledTimes(2);
    // 완료 후에는 추가 프레임이 스케줄되지 않아야 함
    expect(rafQueue.size).toBe(0);
    expect(flushFrame()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);

    control.destroy();
  });

  it('tween — V3: 진행 중 재시작 시 기존 트윈의 rafId가 취소되고 새 목표로 완주', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });

    control.animateToIndex(1, true); // 첫 트윈: x 0 → 400, rafId=1
    now = 1100;
    flushFrame(); // 첫 트윈 1프레임 진행 → stepTween이 rafId=2 재스케줄
    expect(onChange).toHaveBeenCalledTimes(1);
    const midX = camera.position.x;
    expect(midX).toBeGreaterThan(0);
    expect(midX).toBeLessThan(400);

    control.animateToIndex(2, true); // 재시작 → 기존 트윈(rafId=2) 취소, 새 트윈 x mid → 800
    expect(cancelSpy).toHaveBeenCalledWith(2);

    now = 1250;
    flushFrame(); // 새 트윈 t=0.5 — 이중 스텝 없이 프레임당 onChange 1회
    expect(onChange).toHaveBeenCalledTimes(2);
    now = 1400;
    flushFrame(); // 새 트윈 t=1.0
    expect(onChange).toHaveBeenCalledTimes(3);

    expect(camera.position.x).toBe(800);
    expect(rafQueue.size).toBe(0);

    control.destroy();
  });

  it('tween — V4: zoom 트윈은 projection 갱신, zoom 불변 트윈은 스텝 중 projection 미갱신', () => {
    // (a) zoom 트윈: 1 → 2, t=0.5 → zoom=1.875 + updateProjectionMatrix 호출
    const controlA = makeControl();
    const updateSpyA = vi.spyOn(camera, 'updateProjectionMatrix');
    controlA.animateToZoom(2, true);
    now = 1150;
    flushFrame();
    expect(camera.zoom).toBeCloseTo(1.875, 6);
    expect(updateSpyA).toHaveBeenCalled();
    controlA.destroy();

    // (b) 별도 인스턴스: index 트윈은 fromZoom === toZoom → 스텝 중 projection 미갱신
    const cameraB = makeCamera();
    const controlB = makeControl({}, cameraB);
    const updateSpyB = vi.spyOn(cameraB, 'updateProjectionMatrix');
    now = 2000;
    controlB.animateToIndex(2, true);
    now = 2150;
    flushFrame();
    expect(cameraB.position.x).toBeCloseTo(700, 6);
    expect(updateSpyB).not.toHaveBeenCalled();
    controlB.destroy();
  });

  it('tween — V5: cancelAnimation()은 트윈을 중단하고 위치를 동결한다', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });

    control.animateToIndex(2, true);
    now = 1150;
    flushFrame(); // t=0.5 → x=700
    expect(camera.position.x).toBeCloseTo(700, 6);

    control.cancelAnimation();
    expect(cancelSpy).toHaveBeenCalled();

    now = 1300;
    flushAll(); // 잔여 큐 flush 시도 — 취소됐으므로 카메라 불변
    expect(camera.position.x).toBeCloseTo(700, 6);
    expect(onChange).toHaveBeenCalledTimes(1);

    control.destroy();
  });

  it('tween — V6: destroy()가 진행 중 트윈을 취소한다 (위치 불변, throw 없음)', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });

    control.animateToIndex(2, true);
    now = 1150;
    flushFrame();
    const frozenX = camera.position.x;
    expect(frozenX).toBeCloseTo(700, 6);

    const onChangeCallsBeforeDestroy = onChange.mock.calls.length;
    expect(() => control.destroy()).not.toThrow();
    expect(cancelSpy).toHaveBeenCalled();

    now = 1300;
    flushAll();
    expect(camera.position.x).toBe(frozenX);
    expect(onChange).toHaveBeenCalledTimes(1);
    // destroy 후 잔여 RAF flush는 onChange를 추가 발화시키지 않는다 — 트윈 정지 (B-22)
    expect(onChange.mock.calls.length).toBe(onChangeCallsBeforeDestroy);
  });
});
