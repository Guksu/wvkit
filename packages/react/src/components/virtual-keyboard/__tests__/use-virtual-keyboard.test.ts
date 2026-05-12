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
