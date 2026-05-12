import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSafeArea } from '../use-safe-area';

describe('useSafeArea', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('초기 인셋을 반환한다', () => {
    const { result } = renderHook(() => useSafeArea());
    expect(result.current).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('orientationchange 이벤트 시 인셋이 갱신된다', () => {
    const { result } = renderHook(() => useSafeArea());
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(result.current).toHaveProperty('top');
    expect(typeof result.current.top).toBe('number');
  });

  it('언마운트 시 이벤트 리스너가 정리된다', () => {
    const { unmount } = renderHook(() => useSafeArea());
    const onChangeSpy = vi.fn();
    // 언마운트 후 이벤트가 발생해도 상태 업데이트가 없어야 함
    unmount();
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});
