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
  let baseHeight = window.visualViewport?.height ?? window.innerHeight;
  let baseWidth = window.visualViewport?.width ?? window.innerWidth;
  const threshold = options.threshold ?? 100;

  function update() {
    const currentHeight = window.visualViewport?.height ?? window.innerHeight;
    const currentWidth = window.visualViewport?.width ?? window.innerWidth;
    // 키보드는 뷰포트 너비를 바꾸지 않는다 — 너비가 변했다면 회전/창 크기 변경이므로
    // 기준 높이를 재설정해 높이 감소가 키보드로 오검출되는 것을 막는다.
    if (currentWidth !== baseWidth) {
      baseWidth = currentWidth;
      baseHeight = currentHeight;
    }
    // 키보드가 이미 열린 상태에서 생성되면 baseHeight가 축소된 높이로 잡힌다.
    // 뷰포트가 기준보다 커지는 순간(키보드 닫힘)을 실제 전체 높이로 반영해
    // 오염된 기준이 회전 전까지 남는 것을 방지.
    if (currentHeight > baseHeight) {
      baseHeight = currentHeight;
    }
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
