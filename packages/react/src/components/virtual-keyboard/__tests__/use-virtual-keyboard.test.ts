import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualKeyboard } from '../use-virtual-keyboard';

function mockVisualViewport(height = 800) {
  let resizeHandler: EventListener | undefined;
  const vv = {
    height,
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (type === 'resize') resizeHandler = handler;
    }),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true });
  return { vv, fireResize: () => resizeHandler?.(new Event('resize')) };
}

describe('useVirtualKeyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('초기 상태는 isOpen=false, keyboardHeight=0이다', () => {
    mockVisualViewport(800);
    const { result } = renderHook(() => useVirtualKeyboard());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('threshold 옵션을 전달하면 에러 없이 초기화된다', () => {
    mockVisualViewport(800);
    const { result } = renderHook(() => useVirtualKeyboard({ threshold: 150 }));
    expect(result.current.isOpen).toBe(false);
  });

  it('언마운트 시 에러 없이 정리된다', () => {
    mockVisualViewport(800);
    const { unmount } = renderHook(() => useVirtualKeyboard());
    expect(() => unmount()).not.toThrow();
  });

  it('visualViewport가 줄어들면 isOpen=true, keyboardHeight가 업데이트된다', () => {
    const { vv, fireResize } = mockVisualViewport(800);
    const { result } = renderHook(() => useVirtualKeyboard());

    act(() => {
      vv.height = 500; // delta=300, threshold=100 초과
      fireResize();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.keyboardHeight).toBe(300);
  });

  it('delta가 threshold 이하면 isOpen=false를 유지한다', () => {
    const { vv, fireResize } = mockVisualViewport(800);
    const { result } = renderHook(() => useVirtualKeyboard());

    act(() => {
      vv.height = 750; // delta=50, threshold=100 이하
      fireResize();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });
});

/**
 * [B-09] 어댑터 실질화 — unmount(destroy) 시 등록된 모든 (target, type, handler)
 * 리스너가 짝 맞춰 제거되는지 add/remove spy로 단언한다.
 */
describe('useVirtualKeyboard [B-09] 실질 검증', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** added의 모든 (type, handler) 쌍에 대응하는 remove 호출이 존재하는지 짝 맞춤 */
  function expectPairedRemoval(
    added: Array<[string, EventListener]>,
    removed: Array<[string, EventListener]>,
  ) {
    for (const [type, handler] of added) {
      const matched = removed.some(([rType, rHandler]) => rType === type && rHandler === handler);
      expect(matched, `(${type}) 리스너에 대응하는 removeEventListener 호출 없음`).toBe(true);
    }
  }

  it('[B-09] A8: unmount 시 visualViewport/window에 등록한 리스너 전부가 짝 맞춰 제거된다', () => {
    // --- visualViewport 경로 (iOS/Android 현대 브라우저) ---
    const { vv } = mockVisualViewport(800);
    const { unmount } = renderHook(() => useVirtualKeyboard());

    const vvAdded = vv.addEventListener.mock.calls as Array<[string, EventListener]>;
    // core는 vv에 resize + scroll 두 리스너를 등록한다 — 등록 자체가 있어야 의미 있는 단언
    expect(vvAdded.length).toBeGreaterThanOrEqual(2);
    expect(vvAdded.map(([type]) => type)).toContain('resize');

    unmount();
    const vvRemoved = vv.removeEventListener.mock.calls as Array<[string, EventListener]>;
    expectPairedRemoval(vvAdded, vvRemoved);
    // 수량도 일치 — 제거 누락/과잉 제거 모두 검출
    expect(vvRemoved.length).toBe(vvAdded.length);

    // --- window 폴백 경로 (visualViewport 미지원 환경) ---
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount: unmountFallback } = renderHook(() => useVirtualKeyboard());
    // React 내부 리스너 노이즈를 피해 core가 쓰는 'resize' 타입만 짝 맞춤
    const winAdded = (winAdd.mock.calls as Array<[string, EventListener]>).filter(
      ([type]) => type === 'resize',
    );
    expect(winAdded.length).toBeGreaterThanOrEqual(1);

    unmountFallback();
    const winRemoved = (winRemove.mock.calls as Array<[string, EventListener]>).filter(
      ([type]) => type === 'resize',
    );
    expectPairedRemoval(winAdded, winRemoved);
  });
});
