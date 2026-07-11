import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSafeArea } from '../safe-area';

describe('createSafeArea', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('에러 없이 초기화된다', () => {
    const instance = createSafeArea();
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('getInsets()가 top/right/bottom/left를 반환한다', () => {
    const instance = createSafeArea();
    const insets = instance.getInsets();
    expect(insets).toHaveProperty('top');
    expect(insets).toHaveProperty('right');
    expect(insets).toHaveProperty('bottom');
    expect(insets).toHaveProperty('left');
    expect(typeof insets.top).toBe('number');
    instance.destroy();
  });

  it('orientationchange 이벤트 발생 시 onChange가 호출된다', () => {
    const onChange = vi.fn();
    const instance = createSafeArea({ onChange });
    window.dispatchEvent(new Event('orientationchange'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
    instance.destroy();
  });

  it('resize 이벤트 발생 시 onChange가 호출된다', () => {
    const onChange = vi.fn();
    const instance = createSafeArea({ onChange });
    window.dispatchEvent(new Event('resize'));
    expect(onChange).toHaveBeenCalledOnce();
    instance.destroy();
  });

  it('destroy 호출 후에는 이벤트 리스너가 제거된다', () => {
    const onChange = vi.fn();
    const instance = createSafeArea({ onChange });
    instance.destroy();
    window.dispatchEvent(new Event('resize'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('destroy 호출 시 sentinel 엘리먼트가 DOM에서 제거된다', () => {
    const instance = createSafeArea();
    expect(document.body.children.length).toBe(1);
    instance.destroy();
    expect(document.body.children.length).toBe(0);
  });

  describe('inset parsing — getComputedStyle 스텁 (B-22 / T3)', () => {
    type PaddingKey = 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft';
    type PaddingValues = Record<PaddingKey, string>;

    /**
     * happy-dom은 env(safe-area-inset-*)를 0으로 계산하므로 getComputedStyle을 스텁해
     * sentinel 엘리먼트에 대해서만 주입값을 반환한다. 다른 엘리먼트 호출은 원본에 위임 —
     * 전역 오염 금지. afterEach의 vi.restoreAllMocks()로 복원된다.
     */
    function stubSentinelComputedStyle(
      sentinel: Element,
      initial: Partial<PaddingValues>,
    ): { set(next: Partial<PaddingValues>): void } {
      const original = window.getComputedStyle.bind(window);
      let values: PaddingValues = {
        paddingTop: '0px',
        paddingRight: '0px',
        paddingBottom: '0px',
        paddingLeft: '0px',
        ...initial,
      };
      vi.spyOn(window, 'getComputedStyle').mockImplementation(((
        el: Element,
        pseudo?: string | null,
      ) => {
        if (el !== sentinel) return original(el, pseudo);
        return values as unknown as CSSStyleDeclaration;
      }) as typeof window.getComputedStyle);
      return {
        set(next: Partial<PaddingValues>) {
          values = { ...values, ...next };
        },
      };
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('TC-22-20: padding 값이 숫자 인셋으로 파싱되고 방향이 매핑된다', () => {
      const instance = createSafeArea();
      const sentinel = document.body.lastElementChild!;
      stubSentinelComputedStyle(sentinel, { paddingTop: '44px', paddingBottom: '34px' });

      expect(instance.getInsets()).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });
      instance.destroy();
    });

    it('TC-22-21: 파싱 불가 문자열은 각 인셋 0으로 폴백한다', () => {
      const instance = createSafeArea();
      const sentinel = document.body.lastElementChild!;
      stubSentinelComputedStyle(sentinel, {
        paddingTop: '',
        paddingRight: '',
        paddingBottom: '',
        paddingLeft: '',
      });

      expect(instance.getInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
      instance.destroy();
    });

    it('TC-22-22: orientationchange 시 onChange가 재파싱된 새 인셋으로 호출된다', () => {
      const onChange = vi.fn();
      const instance = createSafeArea({ onChange });
      const sentinel = document.body.lastElementChild!;
      const stub = stubSentinelComputedStyle(sentinel, { paddingTop: '44px' });
      expect(instance.getInsets().top).toBe(44);

      stub.set({ paddingTop: '20px' });
      window.dispatchEvent(new Event('orientationchange'));

      // 동적 갱신이 캐시가 아닌 재파싱을 거친다
      expect(onChange).toHaveBeenCalledWith({ top: 20, right: 0, bottom: 0, left: 0 });
      instance.destroy();
    });
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createSafeArea();
    expect(instance.getInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(() => instance.destroy()).not.toThrow();
    // destroy 후에도 getter 값이 유지된다 (B-22)
    expect(instance.getInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    globalThis.window = original;
  });
});
