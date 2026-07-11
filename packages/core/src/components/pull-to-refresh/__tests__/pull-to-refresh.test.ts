import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebviewHeadlessError } from '../../../errors';
import { createPullToRefresh } from '../pull-to-refresh';
import { applyResistance, easeOutCubic } from '../utils';

/**
 * PullToRefresh 종합 단위 테스트.
 *
 * 본 파일 스코프:
 *  - 초기화 + SSR + 옵션 검증
 *  - 상태 머신 (idle/refreshing/resetting/idle 사이클)
 *  - onRefresh 형태 (Promise/void/throw/reject)
 *  - applyResistance 수식 + easeOutCubic
 *  - overscroll-behavior 자동 적용 + 복원
 *  - destroy 멱등성 + listener cleanup
 *
 * happy-dom 한계:
 *  - TouchEvent dispatch는 통합 테스트(#22)에서 본격 검증
 *  - 본 파일은 명령형 API (`trigger`, `setEnabled`, `getState`) 위주
 */

function makeRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

describe('PullToRefresh utils — applyResistance', () => {
  it('rawDelta=0 returns 0', () => {
    expect(applyResistance(0, 120, 0.5)).toBe(0);
  });
  it('negative rawDelta returns 0 (위로 당김 무시)', () => {
    expect(applyResistance(-50, 120, 0.5)).toBe(0);
  });
  it('resistance=0 + small rawDelta returns rawDelta (선형)', () => {
    expect(applyResistance(30, 120, 0)).toBe(30);
  });
  it('resistance=0 hard clamps to maxDistance', () => {
    expect(applyResistance(200, 120, 0)).toBe(120);
  });
  it('resistance=1 + rawDelta = 2*maxDistance is dampened below maxDistance', () => {
    // damped = 240 * (1 / (1 + 1 * 240/120)) = 240 / 3 = 80
    const result = applyResistance(240, 120, 1);
    expect(result).toBeLessThan(120);
    expect(result).toBeCloseTo(80, 5);
  });
  it('resistance=0.5 mid-range: rawDelta=120 → 120 * (1/1.5) = 80', () => {
    // damped = 120 * (1 / (1 + 0.5 * 120/120)) = 120 * (1/1.5) = 80
    expect(applyResistance(120, 120, 0.5)).toBeCloseTo(80, 5);
  });
  it('output always ≤ maxDistance for any non-negative rawDelta', () => {
    for (const raw of [10, 60, 120, 240, 1000, 10000]) {
      for (const r of [0, 0.25, 0.5, 0.75, 1]) {
        const result = applyResistance(raw, 120, r);
        expect(result).toBeLessThanOrEqual(120);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('PullToRefresh utils — easeOutCubic', () => {
  it('t=0 returns 0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });
  it('t=1 returns 1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });
  it('t=0.5 returns 0.875', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
});

describe('createPullToRefresh — initialization', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('정상 옵션으로 에러 없이 초기화된다', () => {
    const instance = createPullToRefresh(root, {
      onRefresh: () => {},
    });
    expect(instance).toBeDefined();
    expect(typeof instance.destroy).toBe('function');
    expect(typeof instance.getState).toBe('function');
    expect(typeof instance.trigger).toBe('function');
    expect(typeof instance.setEnabled).toBe('function');
    instance.destroy();
  });

  it('초기 state는 idle', () => {
    const instance = createPullToRefresh(root, { onRefresh: () => {} });
    expect(instance.getState()).toBe('idle');
    instance.destroy();
  });
});

describe('createPullToRefresh — SSR guard', () => {
  it('window가 undefined일 때 noop 인스턴스 반환', () => {
    const originalWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      const sc = createPullToRefresh({} as HTMLElement, { onRefresh: () => {} });
      expect(sc.getState()).toBe('idle');
      expect(() => sc.setEnabled(false)).not.toThrow();
      expect(() => sc.destroy()).not.toThrow();
      // noop 인스턴스 — setEnabled/destroy 이후에도 state 유지 (B-22)
      expect(sc.getState()).toBe('idle');
      // trigger는 Promise 반환
      return sc.trigger().then(() => {
        // SSR 분기에서는 onRefresh 호출 안 됨
        expect(sc.getState()).toBe('idle');
      });
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

describe('createPullToRefresh — validateOptions', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('threshold ≤ 0이면 WebviewHeadlessError throw', () => {
    expect(() =>
      createPullToRefresh(root, { onRefresh: () => {}, threshold: 0 }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createPullToRefresh(root, { onRefresh: () => {}, threshold: -10 }),
    ).toThrow(WebviewHeadlessError);
  });

  it('maxDistance < threshold이면 throw', () => {
    expect(() =>
      createPullToRefresh(root, {
        onRefresh: () => {},
        threshold: 100,
        maxDistance: 50,
      }),
    ).toThrow(WebviewHeadlessError);
  });

  it('resistance ∉ [0, 1]이면 throw', () => {
    expect(() =>
      createPullToRefresh(root, { onRefresh: () => {}, resistance: -0.1 }),
    ).toThrow(WebviewHeadlessError);
    expect(() =>
      createPullToRefresh(root, { onRefresh: () => {}, resistance: 1.5 }),
    ).toThrow(WebviewHeadlessError);
  });

  it('유효한 경계값은 throw 없음', () => {
    const instances = [
      createPullToRefresh(makeRoot(), { onRefresh: () => {}, threshold: 1 }),
      createPullToRefresh(makeRoot(), {
        onRefresh: () => {},
        threshold: 50,
        maxDistance: 50,
      }),
      createPullToRefresh(makeRoot(), { onRefresh: () => {}, resistance: 0 }),
      createPullToRefresh(makeRoot(), { onRefresh: () => {}, resistance: 1 }),
    ];
    for (const inst of instances) inst.destroy();
  });
});

describe('createPullToRefresh — state machine via trigger()', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  it('trigger() with void onRefresh: refreshing → resetting → idle 순서로 전이', async () => {
    const onStateChange = vi.fn();
    const onRefresh = vi.fn();
    const instance = createPullToRefresh(root, { onRefresh, onStateChange });
    await instance.trigger();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    const states = onStateChange.mock.calls.map((c) => c[0]);
    // 'idle' (initial) → trigger 시작: refreshing → resetting → idle
    // setState dedupe로 idle ≠ idle 재호출 안 됨, 시작 idle은 발화 안 됨
    expect(states).toEqual(['refreshing', 'resetting', 'idle']);
    expect(instance.getState()).toBe('idle');
    instance.destroy();
  });

  it('trigger() with Promise onRefresh: Promise resolve까지 refreshing 유지', async () => {
    // dummy 초기화 — Promise 콜백이 동기적으로 resolve를 할당하므로 trigger() 호출 직후엔 실 resolve.
    let resolveRefresh: () => void = () => {};
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const onStateChange = vi.fn();
    const instance = createPullToRefresh(root, { onRefresh, onStateChange });

    const triggerPromise = instance.trigger();
    // 다음 마이크로태스크에서 'refreshing' 상태 진입
    await Promise.resolve();
    expect(instance.getState()).toBe('refreshing');

    // Promise resolve → resetting → idle
    resolveRefresh();
    await triggerPromise;
    expect(instance.getState()).toBe('idle');
    instance.destroy();
  });

  it('동시 호출 차단: 진행 중 trigger는 같은 Promise 반환', async () => {
    let resolveRefresh: () => void = () => {};
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const instance = createPullToRefresh(root, { onRefresh });
    const p1 = instance.trigger();
    const p2 = instance.trigger();
    expect(p1).toBe(p2); // 같은 Promise 인스턴스 (runRefresh는 non-async라 동일 Promise 반환)
    resolveRefresh();
    await p1;
    // onRefresh는 1번만 호출됨 (동시 호출 차단)
    expect(onRefresh).toHaveBeenCalledTimes(1);
    instance.destroy();
  });

  it('동일 상태 재진입 시 onStateChange 미호출 (dedupe)', async () => {
    const onStateChange = vi.fn();
    const instance = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    // 초기 idle, 별도 트리거 없음 → onStateChange 호출 0
    expect(onStateChange).not.toHaveBeenCalled();
    await instance.trigger();
    // trigger 후 idle로 복귀했지만, 마지막 idle 발화는 1회 (resetting 다음)
    const idleCount = onStateChange.mock.calls.filter((c) => c[0] === 'idle').length;
    expect(idleCount).toBe(1);
    instance.destroy();
  });
});

describe('createPullToRefresh — onRefresh error handling (D6)', () => {
  let root: HTMLElement;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = makeRoot();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    root.remove();
    errorSpy.mockRestore();
  });

  it('Promise reject 시 console.error 호출 + idle 복귀', async () => {
    const onRefresh = vi.fn(() => Promise.reject(new Error('fetch failed')));
    const instance = createPullToRefresh(root, { onRefresh });
    await instance.trigger();
    expect(errorSpy).toHaveBeenCalled();
    const errArgs = errorSpy.mock.calls[0];
    expect(errArgs?.[0]).toContain('PullToRefresh onRefresh error');
    expect(instance.getState()).toBe('idle');
    instance.destroy();
  });

  it('동기 throw 시 console.error 호출 + idle 복귀', async () => {
    const onRefresh = vi.fn(() => {
      throw new Error('sync throw');
    });
    const instance = createPullToRefresh(root, { onRefresh });
    await instance.trigger();
    expect(errorSpy).toHaveBeenCalled();
    expect(instance.getState()).toBe('idle');
    instance.destroy();
  });
});

describe('createPullToRefresh — overscroll-behavior (D3)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('기본 disableOverscrollContain=false → root.style.overscrollBehavior=contain', () => {
    expect(root.style.overscrollBehavior).toBe('');
    const instance = createPullToRefresh(root, { onRefresh: () => {} });
    expect(root.style.overscrollBehavior).toBe('contain');
    instance.destroy();
  });

  it('disableOverscrollContain: true → overscrollBehavior 변경 안 됨', () => {
    const instance = createPullToRefresh(root, {
      onRefresh: () => {},
      disableOverscrollContain: true,
    });
    expect(root.style.overscrollBehavior).toBe('');
    instance.destroy();
  });

  it('destroy 후 원래 값 복원', () => {
    root.style.overscrollBehavior = 'auto';
    const instance = createPullToRefresh(root, { onRefresh: () => {} });
    expect(root.style.overscrollBehavior).toBe('contain');
    instance.destroy();
    expect(root.style.overscrollBehavior).toBe('auto');
  });
});

describe('createPullToRefresh — destroy lifecycle', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('destroy 후 trigger는 noop (콜백 미호출)', async () => {
    const onRefresh = vi.fn();
    const onStateChange = vi.fn();
    const instance = createPullToRefresh(root, { onRefresh, onStateChange });
    instance.destroy();
    await instance.trigger();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('destroy 멱등성: 2회 호출 throw 없음', () => {
    const onStateChange = vi.fn();
    const instance = createPullToRefresh(root, {
      onRefresh: () => {},
      onStateChange,
    });
    instance.destroy();
    expect(() => instance.destroy()).not.toThrow();
    // 2차 destroy도 상태 전이·콜백 발화 없이 완전 no-op (B-22)
    expect(onStateChange).not.toHaveBeenCalled();
    expect(instance.getState()).toBe('idle');
  });

  it('destroy 후 setEnabled는 noop', () => {
    const instance = createPullToRefresh(root, { onRefresh: () => {} });
    instance.destroy();
    expect(() => instance.setEnabled(false)).not.toThrow();
    expect(() => instance.setEnabled(true)).not.toThrow();
  });

  it('destroy 시 등록한 모든 listener가 removeEventListener로 해제됨', () => {
    const removeSpy = vi.spyOn(root, 'removeEventListener');
    const instance = createPullToRefresh(root, { onRefresh: () => {} });
    instance.destroy();
    // touch 4종 + pointer 4종 = 최소 8 호출
    const types = removeSpy.mock.calls.map((c) => c[0] as string);
    expect(types).toContain('touchstart');
    expect(types).toContain('touchmove');
    expect(types).toContain('touchend');
    expect(types).toContain('touchcancel');
    expect(types).toContain('pointerdown');
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
  });
});

describe('createPullToRefresh — setEnabled / enabled option', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    root.remove();
  });

  it('setEnabled(false)/setEnabled(true) 호출이 throw 없음', () => {
    // 통합 테스트 scenario 9와 동일 계약을 unit 레벨에서 고정 — 토글이 실제 제스처 게이트로 동작 (B-22)
    const pointerEvent = (type: string, pointerId: number, clientY: number) =>
      new PointerEvent(type, { pointerId, clientX: 100, clientY, bubbles: true, cancelable: true });
    const onPull = vi.fn();
    const instance = createPullToRefresh(root, { onRefresh: () => {}, onPull });

    expect(() => instance.setEnabled(false)).not.toThrow();
    // disabled 동안 당김 시퀀스는 onPull을 발화시키지 못한다
    root.dispatchEvent(pointerEvent('pointerdown', 1, 100));
    root.dispatchEvent(pointerEvent('pointermove', 1, 300));
    root.dispatchEvent(pointerEvent('pointerup', 1, 300));
    expect(onPull).not.toHaveBeenCalled();

    expect(() => instance.setEnabled(true)).not.toThrow();
    // 재활성화 후 동일 시퀀스는 onPull을 발화시킨다
    root.dispatchEvent(pointerEvent('pointerdown', 2, 100));
    root.dispatchEvent(pointerEvent('pointermove', 2, 300));
    expect(onPull).toHaveBeenCalled();
    root.dispatchEvent(pointerEvent('pointerup', 2, 300));
    instance.destroy();
  });

  it('trigger()는 enabled 플래그와 무관하게 동작 (외부 override)', async () => {
    const onRefresh = vi.fn();
    const instance = createPullToRefresh(root, {
      onRefresh,
      enabled: false,
    });
    await instance.trigger();
    // 명령형 trigger는 enabled 가드를 우회 (description 해석: 동작하되 콜백만 무시 — 우리는 동작 채택)
    expect(onRefresh).toHaveBeenCalled();
    instance.destroy();
  });
});
