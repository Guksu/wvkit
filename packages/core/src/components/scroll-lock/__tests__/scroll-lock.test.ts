import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScrollLock } from '../scroll-lock';

describe('createScrollLock', () => {
  beforeEach(() => {
    document.body.style.cssText = '';
  });

  afterEach(() => {
    document.body.style.cssText = '';
  });

  it('에러 없이 초기화된다', () => {
    const instance = createScrollLock();
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('초기 상태에서 isLocked는 false다', () => {
    const instance = createScrollLock();
    expect(instance.isLocked).toBe(false);
    instance.destroy();
  });

  it('lock() 호출 시 body overflow가 hidden으로 설정된다', () => {
    const instance = createScrollLock();
    instance.lock();
    expect(document.body.style.overflow).toBe('hidden');
    expect(instance.isLocked).toBe(true);
    instance.destroy();
  });

  it('lock() 호출 시 touchmove 리스너가 document에 등록된다', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const instance = createScrollLock();
    instance.lock();
    expect(addSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    instance.destroy();
  });

  it('unlock() 호출 시 body 스타일이 초기화된다', () => {
    const instance = createScrollLock();
    instance.lock();
    instance.unlock();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
    expect(instance.isLocked).toBe(false);
  });

  it('unlock() 호출 시 touchmove 리스너가 제거된다', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const instance = createScrollLock();
    instance.lock();
    instance.unlock();
    expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
    instance.destroy();
  });

  it('lock()을 여러 번 호출해도 한 번만 적용된다', () => {
    const onLock = vi.fn();
    const instance = createScrollLock({ onLock });
    instance.lock();
    instance.lock();
    expect(onLock).toHaveBeenCalledOnce();
    instance.destroy();
  });

  it('unlock()을 여러 번 호출해도 한 번만 실행된다', () => {
    const onUnlock = vi.fn();
    const instance = createScrollLock({ onUnlock });
    instance.lock();
    instance.unlock();
    instance.unlock();
    expect(onUnlock).toHaveBeenCalledOnce();
    instance.destroy();
  });

  it('lock() 시 onLock 콜백이 호출된다', () => {
    const onLock = vi.fn();
    const instance = createScrollLock({ onLock });
    instance.lock();
    expect(onLock).toHaveBeenCalledOnce();
    instance.destroy();
  });

  it('unlock() 시 onUnlock 콜백이 호출된다', () => {
    const onUnlock = vi.fn();
    const instance = createScrollLock({ onUnlock });
    instance.lock();
    instance.unlock();
    expect(onUnlock).toHaveBeenCalledOnce();
    instance.destroy();
  });

  it('destroy() 호출 시 잠긴 상태면 unlock이 실행된다', () => {
    const instance = createScrollLock();
    instance.lock();
    instance.destroy();
    expect(document.body.style.overflow).toBe('');
    expect(instance.isLocked).toBe(false);
  });

  it('body 스타일이 변경되어도 html 배경색은 변하지 않는다', () => {
    const before = document.documentElement.style.backgroundColor;
    const instance = createScrollLock();
    instance.lock();
    expect(document.documentElement.style.backgroundColor).toBe(before);
    instance.destroy();
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createScrollLock();
    expect(instance.isLocked).toBe(false);
    expect(() => instance.lock()).not.toThrow();
    expect(() => instance.unlock()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
    globalThis.window = original;
  });
});
