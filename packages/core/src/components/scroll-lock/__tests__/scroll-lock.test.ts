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

  it('lock 이전의 인라인 overflow 값이 unlock 시 그대로 복원된다', () => {
    document.body.style.overflow = 'scroll';
    document.body.style.overscrollBehavior = 'contain';
    const instance = createScrollLock();
    instance.lock();
    expect(document.body.style.overflow).toBe('hidden');
    instance.unlock();
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.style.overscrollBehavior).toBe('contain');
    instance.destroy();
  });

  describe('allowScrollWithin', () => {
    function dispatchTouchMove(target: Element) {
      const event = new Event('touchmove', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    }

    it('허용 영역 안에서 발생한 touchmove는 preventDefault되지 않는다', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-body';
      const inner = document.createElement('p');
      modal.appendChild(inner);
      document.body.appendChild(modal);

      const instance = createScrollLock({ allowScrollWithin: '.modal-body' });
      instance.lock();

      expect(dispatchTouchMove(inner).defaultPrevented).toBe(false);

      instance.destroy();
      modal.remove();
    });

    it('허용 영역 밖에서 발생한 touchmove는 preventDefault된다', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-body';
      const outside = document.createElement('div');
      document.body.appendChild(modal);
      document.body.appendChild(outside);

      const instance = createScrollLock({ allowScrollWithin: '.modal-body' });
      instance.lock();

      expect(dispatchTouchMove(outside).defaultPrevented).toBe(true);

      instance.destroy();
      modal.remove();
      outside.remove();
    });

    it('엘리먼트로 지정해도 하위 영역의 touchmove가 허용된다', () => {
      const modal = document.createElement('div');
      const inner = document.createElement('p');
      modal.appendChild(inner);
      document.body.appendChild(modal);

      const instance = createScrollLock({ allowScrollWithin: modal });
      instance.lock();

      expect(dispatchTouchMove(inner).defaultPrevented).toBe(false);
      expect(dispatchTouchMove(document.body).defaultPrevented).toBe(true);

      instance.destroy();
      modal.remove();
    });

    it('옵션이 없으면 모든 touchmove가 preventDefault된다 (기존 동작 유지)', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      const instance = createScrollLock();
      instance.lock();

      expect(dispatchTouchMove(el).defaultPrevented).toBe(true);

      instance.destroy();
      el.remove();
    });
  });

  it('[B-25] L1: unlock은 lock 시점의 scrollY로 window.scrollTo를 호출한다(안전망)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      const instance = createScrollLock();
      instance.lock();
      // lock 이후 위치가 틀어진 상황 모사 (주소창 축소/키보드 등)
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      instance.unlock();
      // 주석이 약속하는 안전망 — lock "시점"에 저장한 값(120)으로 복원한다
      expect(scrollToSpy).toHaveBeenCalledWith(0, 120);
      instance.destroy();
    } finally {
      scrollToSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(window, 'scrollY', originalDescriptor);
      } else {
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
      }
    }
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createScrollLock();
    expect(instance.isLocked).toBe(false);
    const overflowBefore = document.body.style.overflow;
    expect(() => instance.lock()).not.toThrow();
    // noop 인스턴스 — lock()이 상태를 바꾸지도, body 스타일을 건드리지도 않는다 (B-22)
    expect(instance.isLocked).toBe(false);
    expect(document.body.style.overflow).toBe(overflowBefore);
    expect(() => instance.unlock()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
    globalThis.window = original;
  });
});
