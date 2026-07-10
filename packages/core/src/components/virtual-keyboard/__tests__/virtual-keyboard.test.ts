import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVirtualKeyboard } from '../virtual-keyboard';

function mockVisualViewport(height: number) {
  const vp = {
    height,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    value: vp,
    writable: true,
    configurable: true,
  });
  return vp;
}

function clearVisualViewport() {
  Object.defineProperty(window, 'visualViewport', {
    value: null,
    writable: true,
    configurable: true,
  });
}

describe('createVirtualKeyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearVisualViewport();
  });

  it('에러 없이 초기화된다', () => {
    const instance = createVirtualKeyboard();
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('초기 상태에서 isOpen은 false, keyboardHeight는 0이다', () => {
    const instance = createVirtualKeyboard();
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    instance.destroy();
  });

  it('visualViewport가 있으면 resize 이벤트를 구독한다', () => {
    const vp = mockVisualViewport(800);
    const instance = createVirtualKeyboard();
    expect(vp.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    instance.destroy();
  });

  it('destroy 호출 시 visualViewport 리스너가 제거된다', () => {
    const vp = mockVisualViewport(800);
    const instance = createVirtualKeyboard();
    instance.destroy();
    expect(vp.removeEventListener).toHaveBeenCalled();
  });

  it('visualViewport 없으면 window resize 폴백을 사용한다', () => {
    clearVisualViewport();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const instance = createVirtualKeyboard();
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    instance.destroy();
  });

  it('뷰포트 높이가 threshold 이상 감소하면 onChange가 호출된다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const baseHeight = window.innerHeight;
    const instance = createVirtualKeyboard({ onChange });

    Object.defineProperty(window, 'innerHeight', { value: baseHeight - 300, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(onChange).toHaveBeenCalledWith({ isOpen: true, keyboardHeight: 300 });
    instance.destroy();
    Object.defineProperty(window, 'innerHeight', { value: baseHeight, writable: true, configurable: true });
  });

  it('threshold 미만 변화에는 onChange가 호출되지 않는다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const baseHeight = window.innerHeight;
    const instance = createVirtualKeyboard({ onChange, threshold: 150 });

    Object.defineProperty(window, 'innerHeight', { value: baseHeight - 50, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(onChange).not.toHaveBeenCalled();
    instance.destroy();
    Object.defineProperty(window, 'innerHeight', { value: baseHeight, writable: true, configurable: true });
  });

  it('동일한 상태에서는 onChange가 중복 호출되지 않는다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const instance = createVirtualKeyboard({ onChange });
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(onChange).not.toHaveBeenCalled();
    instance.destroy();
  });

  it('키보드가 열린 상태에서 생성돼도 키보드가 닫히면 기준 높이가 회복된다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const fullHeight = 800;
    const setInnerHeight = (value: number) =>
      Object.defineProperty(window, 'innerHeight', { value, writable: true, configurable: true });

    // 키보드가 이미 열린(축소된) 뷰포트에서 인스턴스 생성 — baseHeight 오염 시나리오
    setInnerHeight(fullHeight - 300);
    const instance = createVirtualKeyboard({ onChange });

    // 키보드 닫힘: 뷰포트가 기준보다 커짐 → 기준 높이가 전체 높이로 갱신돼야 함
    setInnerHeight(fullHeight);
    window.dispatchEvent(new Event('resize'));
    expect(onChange).not.toHaveBeenCalled();
    expect(instance.isOpen).toBe(false);

    // 이후 키보드가 다시 열리면 정상적으로 감지돼야 함 (수정 전에는 delta=0으로 감지 불능)
    setInnerHeight(fullHeight - 300);
    window.dispatchEvent(new Event('resize'));
    expect(onChange).toHaveBeenCalledWith({ isOpen: true, keyboardHeight: 300 });

    instance.destroy();
    setInnerHeight(fullHeight);
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createVirtualKeyboard();
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    expect(() => instance.destroy()).not.toThrow();
    globalThis.window = original;
  });
});
