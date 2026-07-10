import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPullToRefresh } from '../pull-to-refresh';

/**
 * PullToRefresh TouchEvent 경로 + 소스 승계 단위 테스트 (B-08 / Sprint 5 T-01).
 *
 * 대상 (소스 변경 없음 — 계약 고정):
 *  - onTouchStart/Move/End (pull-to-refresh.ts 216-273): 단일 터치 가드, identifier 매칭,
 *    양수 delta에서만 `preventDefault`, 음수 delta 0 고정, touchcancel = release.
 *  - 소스 승계 (224-231): `activeSource==='pointer' && activePointerIsTouch → 'touch'`
 *    — iOS에서 pointerdown(touch 합성)이 touchstart보다 먼저 도착하는 순서를 재현.
 *
 * happy-dom v15 제약:
 *  - `TouchEvent` 생성자 부분 지원 → `new Event` + `Object.defineProperty`로
 *    `touches`/`changedTouches` 주입 (StableInput 테스트와 동일 패턴).
 *    소스가 소비하는 표면만 구현: TouchList 유사 `{ length, item(i) }`,
 *    Touch 유사 `{ identifier, clientX, clientY }`.
 *  - `preventDefault` 단언은 dispatch 후 `ev.defaultPrevented` (cancelable: true 필수).
 *  - reset 트윈(RAF 200ms)은 `await wait(300)`으로 flush.
 *
 * 감쇠 기대값 (applyResistance, 기본 threshold 60 / maxDistance 120 / resistance 0.5):
 *   damped = raw / (1 + 0.5·raw/120) → raw 40 → 240/7 ≈ 34.29, raw 100 → 1200/17 ≈ 70.59 (≥60 → armed)
 */

function makeRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

interface TouchPoint {
  id: number;
  y: number;
}

interface FakeTouch {
  identifier: number;
  clientX: number;
  clientY: number;
}

function makeTouchList(points: TouchPoint[]): { length: number; item(i: number): FakeTouch | null } {
  const touches: FakeTouch[] = points.map((p) => ({
    identifier: p.id,
    clientX: 100,
    clientY: p.y,
  }));
  return {
    length: touches.length,
    item: (i: number) => touches[i] ?? null,
  };
}

/**
 * happy-dom용 TouchEvent 대체 — `touches`/`changedTouches`를 defineProperty로 주입.
 * `changed` 생략 시 `touches`와 동일 목록 사용.
 */
function touchEvent(type: string, touches: TouchPoint[], changed?: TouchPoint[]): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'touches', { value: makeTouchList(touches) });
  Object.defineProperty(ev, 'changedTouches', { value: makeTouchList(changed ?? touches) });
  return ev;
}

function pointerEvent(
  type: string,
  init: { pointerId: number; clientY: number; pointerType?: string },
): Event {
  const pointerType = init.pointerType ?? 'touch';
  let ev: Event;
  try {
    ev = new PointerEvent(type, {
      pointerId: init.pointerId,
      pointerType,
      clientX: 100,
      clientY: init.clientY,
      bubbles: true,
      cancelable: true,
    });
  } catch {
    ev = new Event(type, { bubbles: true, cancelable: true });
  }
  // happy-dom이 PointerEventInit 일부 필드를 무시할 수 있어 값 보정
  const pev = ev as PointerEvent;
  if (pev.pointerId !== init.pointerId) {
    Object.defineProperty(ev, 'pointerId', { value: init.pointerId });
  }
  if (pev.clientY !== init.clientY) {
    Object.defineProperty(ev, 'clientY', { value: init.clientY });
  }
  if (pev.pointerType !== pointerType) {
    Object.defineProperty(ev, 'pointerType', { value: pointerType });
  }
  return ev;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** onPull 마지막 호출의 distance 인자 — 미호출이면 명시적 실패. */
function lastPullDistance(onPull: ReturnType<typeof vi.fn>): number {
  const calls = onPull.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('onPull was not called');
  return last[0] as number;
}

describe('PullToRefresh — touch path (U-A)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  // --- U1 ---
  it('touch — touchstart alone starts the gesture and touchmove reports dampened distance', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 140 }]));

    expect(ptr.getState()).toBe('pulling');
    expect(onPull).toHaveBeenCalled();
    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBeCloseTo(240 / 7, 2);
    ptr.destroy();
  });

  // --- U2 ---
  it('touch — armed release runs onRefresh exactly once through pulling→armed→refreshing→resetting→idle', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh, onStateChange });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    // raw 100 → damped 1200/17 ≈ 70.59 ≥ threshold 60 → armed
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 200 }]));
    expect(ptr.getState()).toBe('armed');
    root.dispatchEvent(touchEvent('touchend', [], [{ id: 1, y: 200 }]));
    await wait(300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(ptr.getState()).toBe('idle');
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toEqual(['pulling', 'armed', 'refreshing', 'resetting', 'idle']);
    ptr.destroy();
  });

  // --- U3 ---
  it('touch — positive-delta touchmove is preventDefault-ed (native scroll blocked while pulling)', () => {
    const ptr = createPullToRefresh(root, { onRefresh: () => {} });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    const move = touchEvent('touchmove', [{ id: 1, y: 140 }]);
    root.dispatchEvent(move);

    expect(move.defaultPrevented).toBe(true);
    ptr.destroy();
  });

  // --- U4 ---
  it('touch — negative delta pins distance to 0 and does NOT preventDefault (native scroll passes)', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    const move = touchEvent('touchmove', [{ id: 1, y: 80 }]);
    root.dispatchEvent(move);

    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBe(0);
    expect(move.defaultPrevented).toBe(false);
    ptr.destroy();
  });

  // --- U5 ---
  it('touch — multi-touch touchstart is rejected (stays idle, no state callback)', () => {
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onStateChange });

    root.dispatchEvent(
      touchEvent('touchstart', [
        { id: 1, y: 100 },
        { id: 2, y: 110 },
      ]),
    );

    expect(ptr.getState()).toBe('idle');
    expect(onStateChange).not.toHaveBeenCalled();
    ptr.destroy();
  });

  // --- U6 ---
  it('touch — touchmove with a non-matching identifier is ignored', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 9, y: 200 }]));

    expect(onPull).not.toHaveBeenCalled();
    expect(ptr.getState()).toBe('pulling');
    ptr.destroy();
  });

  // --- U7 ---
  it('touch — touchend whose changedTouches do not match the active identifier is ignored', () => {
    const onRefresh = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 200 }]));
    expect(ptr.getState()).toBe('armed');
    root.dispatchEvent(touchEvent('touchend', [{ id: 1, y: 200 }], [{ id: 9, y: 200 }]));

    expect(onRefresh).not.toHaveBeenCalled();
    expect(ptr.getState()).toBe('armed');
    ptr.destroy();
  });

  // --- U8 ---
  it('touch — touchcancel takes the release path (sub-threshold → resetting → idle, no refresh)', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh, onStateChange });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 140 }]));
    expect(ptr.getState()).toBe('pulling');
    root.dispatchEvent(touchEvent('touchcancel', [], [{ id: 1, y: 140 }]));
    await wait(300);

    expect(onRefresh).not.toHaveBeenCalled();
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toContain('resetting');
    expect(states).not.toContain('refreshing');
    expect(ptr.getState()).toBe('idle');
    ptr.destroy();
  });
});

describe('PullToRefresh — source inheritance / double-handling guard (U-B)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  // --- U9 ---
  it('touch — synthetic pointer(touch) gesture is inherited by touchstart, then touch drives distance', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    // 실기기 순서: pointerdown(touch 합성)이 touchstart보다 먼저 도착
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100, pointerType: 'touch' }));
    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));

    // 승계 후 pointermove는 무시되어야 함
    const callsBefore = onPull.mock.calls.length;
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300, pointerType: 'touch' }));
    expect(onPull.mock.calls.length).toBe(callsBefore);

    // touchmove가 distance를 구동 — raw 100 (startClientY 100 승계 증명: y 200 - 100)
    const move = touchEvent('touchmove', [{ id: 1, y: 200 }]);
    root.dispatchEvent(move);
    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBeCloseTo(1200 / 17, 2);
    expect(move.defaultPrevented).toBe(true);
    ptr.destroy();
  });

  // --- U10 ---
  it('touch — after inheritance touchend fires refresh once and trailing pointerup is a no-op', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh, onStateChange });

    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100, pointerType: 'touch' }));
    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300, pointerType: 'touch' }));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 200 }]));
    expect(ptr.getState()).toBe('armed');

    root.dispatchEvent(touchEvent('touchend', [], [{ id: 1, y: 200 }]));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 200, pointerType: 'touch' }));
    await wait(300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(ptr.getState()).toBe('idle');
    // 정확한 전이열 — pointerup이 idle 이후 추가 전이를 만들지 않음
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toEqual(['pulling', 'armed', 'refreshing', 'resetting', 'idle']);
    ptr.destroy();
  });

  // --- U11 ---
  it('touch — non-synthetic pointer(mouse) is NOT inherited: touch events ignored, pointer drives distance', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100, pointerType: 'mouse' }));
    root.dispatchEvent(touchEvent('touchstart', [{ id: 5, y: 100 }]));

    // mouse 제스처가 활성 → touchmove는 무시 (preventDefault도 없어야 함)
    const move = touchEvent('touchmove', [{ id: 5, y: 200 }]);
    root.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(false);
    expect(onPull).not.toHaveBeenCalled();

    // pointermove가 distance를 구동 — raw 40 → 240/7
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140, pointerType: 'mouse' }));
    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBeCloseTo(240 / 7, 2);
    ptr.destroy();
  });
});

/**
 * T-02 커버리지 램프 보강 — 실측 branches가 plan 체크포인트(≥90)에 미달해
 * 계약상 의미 있는 경계 가드를 추가 고정 (299-300·330-332 잔여 라인 커버가 목적이 아님).
 */
describe('PullToRefresh — boundary guards (coverage ramp)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  // 111: armed → 되돌아가면 pulling으로 강등
  it('touch — dropping back below threshold demotes armed to pulling', () => {
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onStateChange });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 200 }])); // damped ≈ 70.59 → armed
    expect(ptr.getState()).toBe('armed');
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 150 }])); // raw 50 → damped ≈ 41.38 < 60

    expect(ptr.getState()).toBe('pulling');
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toEqual(['pulling', 'armed', 'pulling']);
    ptr.destroy();
  });

  // 118: refreshing 중 새 touchstart는 새 제스처를 시작하지 못함
  it('touch — touchstart during refreshing does not start a new gesture', async () => {
    let resolveRefresh: () => void = () => {};
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh, onStateChange });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 200 }]));
    root.dispatchEvent(touchEvent('touchend', [], [{ id: 1, y: 200 }]));
    expect(ptr.getState()).toBe('refreshing');

    root.dispatchEvent(touchEvent('touchstart', [{ id: 2, y: 100 }]));
    expect(ptr.getState()).toBe('refreshing');
    resolveRefresh();
    await wait(300);

    // refreshing 이후 pulling 재진입 없음 — 정상 종료열만 존재
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toEqual(['pulling', 'armed', 'refreshing', 'resetting', 'idle']);
    ptr.destroy();
  });

  // 261: 활성 제스처 없는 touchend는 no-op
  it('touch — touchend without an active gesture is a no-op', () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh, onStateChange });

    root.dispatchEvent(touchEvent('touchend', [], [{ id: 1, y: 100 }]));

    expect(ptr.getState()).toBe('idle');
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
    ptr.destroy();
  });

  // 279: touch 제스처 활성 중 pointerdown은 무시 (역순 이중처리 방어)
  it('touch — pointerdown while a touch gesture is active is ignored', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientY: 100, pointerType: 'mouse' }));

    // pointer는 제스처를 뺏지 못함 — pointermove 무시, touchmove가 계속 구동
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientY: 300, pointerType: 'mouse' }));
    expect(onPull).not.toHaveBeenCalled();
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 140 }]));
    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBeCloseTo(240 / 7, 2);
    expect(ptr.getState()).toBe('pulling');
    ptr.destroy();
  });

  // 293-294: pointerId 불일치 pointermove 무시
  it('pointer — pointermove with a non-matching pointerId is ignored', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100, pointerType: 'mouse' }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 9, clientY: 300, pointerType: 'mouse' }));
    expect(onPull).not.toHaveBeenCalled();

    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140, pointerType: 'mouse' }));
    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBeCloseTo(240 / 7, 2);
    ptr.destroy();
  });

  // 298: pointer 음수 delta → distance 0 고정 (U4의 pointer 대칭)
  it('pointer — negative delta pins distance to 0', () => {
    const onPull = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100, pointerType: 'mouse' }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 80, pointerType: 'mouse' }));

    const lastDistance = lastPullDistance(onPull);
    expect(lastDistance).toBe(0);
    expect(ptr.getState()).toBe('pulling');
    ptr.destroy();
  });

  // 329: reset 트윈 진행 중 destroy → RAF 취소, 이후 콜백 정지
  it('touch — destroy during reset tween cancels the RAF and stops callbacks', async () => {
    const onPull = vi.fn();
    const onStateChange = vi.fn();
    const ptr = createPullToRefresh(root, { onRefresh: () => {}, onPull, onStateChange });

    root.dispatchEvent(touchEvent('touchstart', [{ id: 1, y: 100 }]));
    root.dispatchEvent(touchEvent('touchmove', [{ id: 1, y: 140 }])); // sub-threshold
    root.dispatchEvent(touchEvent('touchend', [], [{ id: 1, y: 140 }]));
    expect(ptr.getState()).toBe('resetting');

    ptr.destroy();
    const pullCalls = onPull.mock.calls.length;
    const stateCalls = onStateChange.mock.calls.length;
    await wait(300);

    // 트윈이 계속 돌았다면 onPull이 추가 호출되고 최종 idle 전이가 생겼을 것
    expect(onPull.mock.calls.length).toBe(pullCalls);
    expect(onStateChange.mock.calls.length).toBe(stateCalls);
  });
});
