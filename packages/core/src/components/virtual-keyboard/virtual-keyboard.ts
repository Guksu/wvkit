import type { VirtualKeyboardOptions, VirtualKeyboardInstance } from './types';

export function createVirtualKeyboard(options: VirtualKeyboardOptions = {}): VirtualKeyboardInstance {
  if (typeof window === 'undefined') {
    return {
      get isOpen() { return false; },
      get keyboardHeight() { return 0; },
      destroy: () => {},
    };
  }

  const listeners: Array<() => void> = [];

  function addListener(target: Window | VisualViewport, type: string, handler: EventListener) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }

  let isOpen = false;
  let keyboardHeight = 0;

  // 초기화 시점의 뷰포트 높이를 기준으로 키보드 높이를 추론.
  // iOS: window.innerHeight는 고정, visualViewport.height만 줄어듦.
  // Android: window.innerHeight도 줄어들지만 visualViewport.height가 더 신뢰할 수 있음.
  const baseHeight = window.visualViewport?.height ?? window.innerHeight;
  const threshold = options.threshold ?? 100;

  function update() {
    const currentHeight = window.visualViewport?.height ?? window.innerHeight;
    const delta = Math.max(0, baseHeight - currentHeight);
    const newIsOpen = delta > threshold;
    // threshold 미만 변화는 키보드로 간주하지 않고 0으로 처리
    const newKeyboardHeight = newIsOpen ? delta : 0;

    if (newKeyboardHeight === keyboardHeight && newIsOpen === isOpen) return;

    keyboardHeight = newKeyboardHeight;
    isOpen = newIsOpen;
    options.onChange?.({ isOpen, keyboardHeight });
  }

  if (window.visualViewport) {
    addListener(window.visualViewport, 'resize', update);
    addListener(window.visualViewport, 'scroll', update);
  } else {
    addListener(window, 'resize', update);
  }

  function destroy() {
    for (const off of listeners) off();
    listeners.length = 0;
  }

  return {
    get isOpen() { return isOpen; },
    get keyboardHeight() { return keyboardHeight; },
    destroy,
  };
}
