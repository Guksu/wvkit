import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStableInput } from '../stable-input';

describe('createStableInput', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
  });

  it('에러 없이 초기화된다', () => {
    const instance = createStableInput(container, {});
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('컨테이너 안에 displayInput이 추가된다', () => {
    const instance = createStableInput(container, {});
    expect(container.querySelector('input')).not.toBeNull();
    instance.destroy();
  });

  it('document.body에 hiddenInput이 직접 추가된다', () => {
    const instance = createStableInput(container, {});
    // hiddenInput은 body 직하위에, displayInput은 container 안에 위치
    const bodyDirectInputs = Array.from(document.body.children).filter(
      (el) => el.tagName === 'INPUT',
    );
    expect(bodyDirectInputs.length).toBe(1);
    instance.destroy();
  });

  it('destroy 후 displayInput과 hiddenInput이 DOM에서 제거된다', () => {
    const instance = createStableInput(container, {});
    instance.destroy();
    expect(container.querySelector('input')).toBeNull();
    expect(document.body.querySelectorAll('input[style]').length).toBe(0);
  });

  it('setValue로 두 인풋의 값이 동시에 변경된다', () => {
    const instance = createStableInput(container, {});
    instance.setValue('hello');
    expect(instance.getValue()).toBe('hello');
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.value).toBe('hello');
    instance.destroy();
  });

  it('getValue가 현재 값을 반환한다', () => {
    const instance = createStableInput(container, {});
    instance.setValue('world');
    expect(instance.getValue()).toBe('world');
    instance.destroy();
  });

  it('hiddenInput input 이벤트 시 onChange와 displayInput 값이 갱신된다', () => {
    const onChange = vi.fn();
    const instance = createStableInput(container, { onChange });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = 'test';
    hiddenInput.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('test');
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.value).toBe('test');
    instance.destroy();
  });

  it('hiddenInput focus 시 onFocus 호출 및 displayInput data-focused 설정', () => {
    const onFocus = vi.fn();
    const instance = createStableInput(container, { onFocus });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.dispatchEvent(new Event('focus'));
    expect(onFocus).toHaveBeenCalledOnce();
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.dataset.focused).toBe('true');
    instance.destroy();
  });

  it('hiddenInput blur 시 onBlur 호출 및 displayInput data-focused 제거', () => {
    const onBlur = vi.fn();
    const instance = createStableInput(container, { onBlur });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.dispatchEvent(new Event('focus'));
    hiddenInput.dispatchEvent(new Event('blur'));
    expect(onBlur).toHaveBeenCalledOnce();
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.dataset.focused).toBeUndefined();
    instance.destroy();
  });

  it('Enter 키 입력 시 onSubmit이 현재 값으로 호출된다', () => {
    const onSubmit = vi.fn();
    const instance = createStableInput(container, { onSubmit });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = 'send this';
    hiddenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).toHaveBeenCalledWith('send this');
    instance.destroy();
  });

  it('placeholder 옵션이 displayInput과 hiddenInput aria-label에 반영된다', () => {
    const instance = createStableInput(container, { placeholder: '검색어 입력' });
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.placeholder).toBe('검색어 입력');
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    expect(hiddenInput.getAttribute('aria-label')).toBe('검색어 입력');
    instance.destroy();
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // @ts-expect-error — SSR 시뮬레이션
    delete globalThis.window;
    const instance = createStableInput(container, {});
    expect(() => instance.focus()).not.toThrow();
    expect(() => instance.setValue('x')).not.toThrow();
    expect(instance.getValue()).toBe('');
    expect(() => instance.destroy()).not.toThrow();
    globalThis.window = original;
  });
});
