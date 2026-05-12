import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollLock } from '../use-scroll-lock';

describe('useScrollLock', () => {
  afterEach(() => {
    document.body.style.cssText = '';
  });

  it('초기 상태에서 isLocked는 false다', () => {
    const { result } = renderHook(() => useScrollLock());
    expect(result.current.isLocked).toBe(false);
  });

  it('lock() 호출 시 isLocked가 true로 변경된다', () => {
    const { result } = renderHook(() => useScrollLock());
    act(() => { result.current.lock(); });
    expect(result.current.isLocked).toBe(true);
  });

  it('unlock() 호출 시 isLocked가 false로 변경된다', () => {
    const { result } = renderHook(() => useScrollLock());
    act(() => { result.current.lock(); });
    act(() => { result.current.unlock(); });
    expect(result.current.isLocked).toBe(false);
  });

  it('lock() 호출 시 body overflow가 hidden으로 설정된다', () => {
    const { result } = renderHook(() => useScrollLock());
    act(() => { result.current.lock(); });
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('unlock() 호출 시 body overflow가 초기화된다', () => {
    const { result } = renderHook(() => useScrollLock());
    act(() => { result.current.lock(); });
    act(() => { result.current.unlock(); });
    expect(document.body.style.overflow).toBe('');
  });

  it('언마운트 시 잠금 상태가 해제된다', () => {
    const { result, unmount } = renderHook(() => useScrollLock());
    act(() => { result.current.lock(); });
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
