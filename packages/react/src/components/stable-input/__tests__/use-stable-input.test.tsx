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
    let rendered: ReturnType<typeof render> | undefined;
    expect(() => {
      rendered = render(React.createElement(TestComponent));
    }).not.toThrow();
    // 인스턴스 생성 증거 — hiddenInput이 body에, displayInput(readOnly)이 컨테이너에 존재 (B-22)
    expect(getHiddenInput()).toBeDefined();
    const displayInput = rendered!.container.querySelector('input') as HTMLInputElement | null;
    expect(displayInput).not.toBeNull();
    expect(displayInput!.readOnly).toBe(true);
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

/**
 * [B-09] 어댑터 실질화 — StrictMode 이중 마운트 시 인풋 DOM 수량과
 * unmount 시 displayInput/hiddenInput 완전 제거를 수치로 단언한다.
 * (displayInput은 container div 자식, hiddenInput은 body 직접 자식)
 */
describe('useStableInput [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function Host() {
    const { containerRef } = useStableInput({ placeholder: '검색…' });
    return React.createElement(StableInputDisplay, { containerRef });
  }

  it('[B-09] A3: StrictMode 이중 마운트에도 인풋이 정확히 2개(display 1 + hidden 1)다', () => {
    const { container } = render(
      React.createElement(React.StrictMode, null, React.createElement(Host)),
    );
    const containerDiv = container.firstChild as HTMLElement;
    // 이중 마운트 누수면 display 2 + hidden 2 = 4개가 된다
    expect(containerDiv.querySelectorAll('input').length).toBe(1);
    const hiddenInputs = Array.from(document.body.children).filter(
      (el) => el.tagName === 'INPUT',
    );
    expect(hiddenInputs).toHaveLength(1);
    expect(document.querySelectorAll('input').length).toBe(2);
  });

  it('[B-09] A7: unmount 후 document에 인풋이 0개다 (displayInput/hiddenInput.remove 실효)', () => {
    const { unmount } = render(React.createElement(Host));
    expect(document.querySelectorAll('input').length).toBe(2);
    unmount();
    expect(document.querySelectorAll('input').length).toBe(0);
  });
});
