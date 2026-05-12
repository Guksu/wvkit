import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import React from 'react';
import { render } from '@testing-library/react';
import { useStableInput } from '../use-stable-input';
import { StableInputDisplay } from '../StableInputDisplay';

// hiddenInput은 body의 직접 자식 INPUT (displayInput은 container div 안에 중첩됨)
function getHiddenInput(): HTMLInputElement | undefined {
  return Array.from(document.body.children)
    .find((el): el is HTMLInputElement => el.tagName === 'INPUT');
}

describe('useStableInput', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('containerRef가 마운트된 엘리먼트에서 인스턴스가 생성된다', () => {
    function TestComponent() {
      const { containerRef } = useStableInput({ placeholder: '검색…' });
      return React.createElement(StableInputDisplay, { containerRef });
    }
    expect(() => render(React.createElement(TestComponent))).not.toThrow();
  });

  it('마운트 후 hiddenInput이 body 직접 자식으로 추가된다', () => {
    function TestComponent() {
      const { containerRef } = useStableInput();
      return React.createElement(StableInputDisplay, { containerRef });
    }
    render(React.createElement(TestComponent));
    expect(getHiddenInput()).toBeDefined();
  });

  it('onChange 콜백이 hiddenInput input 이벤트에서 호출된다', () => {
    const onChange = vi.fn();
    function TestComponent() {
      const { containerRef } = useStableInput({ onChange });
      return React.createElement(StableInputDisplay, { containerRef });
    }
    render(React.createElement(TestComponent));

    const hiddenInput = getHiddenInput();
    expect(hiddenInput).toBeDefined();

    act(() => {
      Object.defineProperty(hiddenInput!, 'value', { value: 'test', writable: true });
      hiddenInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('언마운트 시 hiddenInput이 제거된다', () => {
    function TestComponent() {
      const { containerRef } = useStableInput();
      return React.createElement(StableInputDisplay, { containerRef });
    }
    const { unmount } = render(React.createElement(TestComponent));
    expect(getHiddenInput()).toBeDefined();
    unmount();
    expect(getHiddenInput()).toBeUndefined();
  });

  it('setValue로 설정한 값을 getValue로 읽을 수 있다', () => {
    let exposedSetValue: ((v: string) => void) | undefined;
    let exposedGetValue: (() => string) | undefined;

    function TestComponent() {
      const { containerRef, setValue, getValue } = useStableInput();
      exposedSetValue = setValue;
      exposedGetValue = getValue;
      return React.createElement(StableInputDisplay, { containerRef });
    }
    render(React.createElement(TestComponent));

    act(() => { exposedSetValue?.('hello'); });
    expect(exposedGetValue?.()).toBe('hello');
  });
});
