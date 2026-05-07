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

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // @ts-expect-error — SSR 시뮬레이션
    delete globalThis.window;
    const instance = createSafeArea();
    expect(instance.getInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(() => instance.destroy()).not.toThrow();
    globalThis.window = original;
  });
});
