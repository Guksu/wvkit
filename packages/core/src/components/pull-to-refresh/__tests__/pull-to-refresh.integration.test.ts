import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPullToRefresh } from '../pull-to-refresh';

/**
 * PullToRefresh 통합 테스트 — 전체 라이프사이클(마운트 → 제스처 → refresh → reset → destroy).
 *
 * 단위 테스트(#19)와의 차이:
 *  - 명령형 API(`trigger`)가 아니라 **dispatched events**를 통한 제스처 시뮬레이션
 *  - 상태 머신 + 콜백 시퀀스를 실 라이프사이클 안에서 검증
 *
 * happy-dom v15 제약:
 *  - `TouchEvent` 생성자는 부분 지원 — 본 파일은 PointerEvent로 시뮬 (구현이 양쪽 핸들러 등록함)
 *  - RAF는 setTimeout 폴리필로 동작, 200ms reset 트윈 후 250~300ms 대기로 flush
 */

function makeRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

function pointerEvent(
  type: string,
  init: { pointerId: number; clientY: number; clientX?: number },
): Event {
  try {
    return new PointerEvent(type, {
      pointerId: init.pointerId,
      clientX: init.clientX ?? 100,
      clientY: init.clientY,
      bubbles: true,
      cancelable: true,
    });
  } catch {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, init);
    return ev;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('PullToRefresh — integration', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  // --- 시나리오 1: pull simulate → state 'pulling' (작은 거리) ---
  it('scenario 1 — small pull keeps state at "pulling" + onPull fires with non-zero distance', () => {
    const onStateChange = vi.fn();
    const onPull = vi.fn();
    const sc = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
      onPull,
    });
    // pointerdown at clientY=100 + small pull to 140 (delta 40px, dampens below threshold 60)
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    expect(sc.getState()).toBe('pulling');
    // onPull called at least once with distance > 0
    const distances = onPull.mock.calls.map((c) => c[0]);
    expect(distances.some((d) => d > 0)).toBe(true);
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toContain('pulling');
    sc.destroy();
  });

  // --- 시나리오 2: threshold 초과 → 'armed' ---
  it('scenario 2 — large pull crosses threshold → state transitions to "armed"', () => {
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    // Big pull: clientY=300 → delta=200, dampened ≈ 109 (with default resistance 0.5, maxDistance 120)
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    expect(sc.getState()).toBe('armed');
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toContain('pulling');
    expect(states).toContain('armed');
    sc.destroy();
  });

  // --- 시나리오 3: release armed → refreshing → resetting → idle (sync onRefresh) ---
  it('scenario 3 — release after armed triggers refresh + completes back to idle', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, { onRefresh, onStateChange });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    expect(sc.getState()).toBe('armed');
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 300 }));
    // 트윈/마이크로태스크 flush
    await wait(300);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(sc.getState()).toBe('idle');
    const states = onStateChange.mock.calls.map((c) => c[0]);
    // pulling → armed → refreshing → resetting → idle 시퀀스 포함
    expect(states).toContain('refreshing');
    expect(states).toContain('resetting');
    expect(states[states.length - 1]).toBe('idle');
    sc.destroy();
  });

  // --- 시나리오 4: release before threshold → resetting → idle (refreshing 스킵) ---
  it('scenario 4 — release before threshold resets without invoking onRefresh', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, { onRefresh, onStateChange });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    expect(sc.getState()).toBe('pulling');
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 140 }));
    await wait(300);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(sc.getState()).toBe('idle');
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).not.toContain('refreshing');
    expect(states).toContain('resetting');
    sc.destroy();
  });

  // --- 시나리오 5: scrollTop > 0 → pull 시도 무시 ---
  it('scenario 5 — pointerdown at scrollTop>0 does NOT enter pulling', () => {
    Object.defineProperty(root, 'scrollTop', { value: 50, configurable: true });
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 200 }));
    expect(sc.getState()).toBe('idle');
    expect(onStateChange).not.toHaveBeenCalled();
    sc.destroy();
  });

  // --- 시나리오 6: Promise 반환 onRefresh 비동기 대기 ---
  it('scenario 6 — Promise onRefresh holds "refreshing" until resolved', async () => {
    let resolveRefresh: () => void = () => {};
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const sc = createPullToRefresh(root, { onRefresh });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 300 }));
    // microtask flush — refreshing 진입
    await Promise.resolve();
    expect(sc.getState()).toBe('refreshing');
    // resolve 전에는 refreshing 유지
    await wait(50);
    expect(sc.getState()).toBe('refreshing');
    // resolve → resetting → idle
    resolveRefresh();
    await wait(300);
    expect(sc.getState()).toBe('idle');
    sc.destroy();
  });

  // --- 시나리오 7: Promise reject → console.error + idle 복귀 ---
  it('scenario 7 — Promise reject logs console.error and returns to idle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRefresh = vi.fn(() => Promise.reject(new Error('fetch failed')));
    const sc = createPullToRefresh(root, { onRefresh });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 300 }));
    await wait(300);
    expect(errorSpy).toHaveBeenCalled();
    expect(sc.getState()).toBe('idle');
    sc.destroy();
    errorSpy.mockRestore();
  });

  // --- 시나리오 8: destroy → 추가 제스처 무발화 + overscroll-behavior 복원 ---
  it('scenario 8 — destroy removes listeners + restores overscroll-behavior', () => {
    root.style.overscrollBehavior = 'auto';
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    expect(root.style.overscrollBehavior).toBe('contain');
    sc.destroy();
    expect(root.style.overscrollBehavior).toBe('auto');
    // destroy 후 제스처 → 콜백 무발화
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientY: 300 }));
    expect(onStateChange).not.toHaveBeenCalled();
  });

  // --- 시나리오 9 (bonus): setEnabled(false) 후 제스처 차단 ---
  it('scenario 9 (bonus) — setEnabled(false) blocks new pulls', () => {
    const onStateChange = vi.fn();
    const sc = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    sc.setEnabled(false);
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    expect(sc.getState()).toBe('idle');
    expect(onStateChange).not.toHaveBeenCalled();
    // 다시 enabled로 → 작동
    sc.setEnabled(true);
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientY: 300 }));
    expect(sc.getState()).toBe('armed');
    sc.destroy();
  });

  // --- 시나리오 10 (bonus): pointercancel → release 처리 ---
  it('scenario 10 (bonus) — pointercancel triggers release flow same as pointerup', async () => {
    const onRefresh = vi.fn();
    const sc = createPullToRefresh(root, { onRefresh });
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 300 }));
    expect(sc.getState()).toBe('armed');
    root.dispatchEvent(pointerEvent('pointercancel', { pointerId: 1, clientY: 300 }));
    await wait(300);
    // pointercancel도 onPointerEnd 핸들러를 거치므로 armed 였다면 refresh 실행
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(sc.getState()).toBe('idle');
    sc.destroy();
  });
});
