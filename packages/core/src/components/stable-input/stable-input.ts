import type { StableInputOptions, StableInputInstance } from './types';

export function createStableInput(
  container: HTMLElement,
  options: StableInputOptions,
): StableInputInstance {
  if (typeof window === 'undefined') {
    return { focus: () => {}, blur: () => {}, setValue: () => {}, getValue: () => '', destroy: () => {} };
  }

  const listeners: Array<() => void> = [];

  function addListener(
    el: Element | Window | VisualViewport,
    type: string,
    handler: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions,
  ) {
    el.addEventListener(type, handler, opts);
    listeners.push(() => el.removeEventListener(type, handler, opts));
  }

  // 디스플레이 인풋: 사용자가 보는 인풋. 스타일은 소비자가 담당.
  // readOnly + tabIndex=-1 로 포커스되지 않도록 설정.
  const displayInput = document.createElement('input');
  displayInput.type = options.type ?? 'text';
  displayInput.readOnly = true;
  displayInput.tabIndex = -1;
  if (options.placeholder) displayInput.placeholder = options.placeholder;
  container.appendChild(displayInput);

  // 숨김 인풋: 실제 포커스 + 키 입력 처리 담당.
  // position:fixed 로 화면 밖에 고정 — iOS에서 포커스 시 페이지 스크롤이 발생하지 않음.
  const hiddenInput = document.createElement('input');
  hiddenInput.type = options.type ?? 'text';
  hiddenInput.setAttribute('aria-label', options.placeholder ?? '');
  if (options.inputMode) hiddenInput.inputMode = options.inputMode;
  if (options.autocomplete) hiddenInput.setAttribute('autocomplete', options.autocomplete);
  hiddenInput.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'width:1px',
    'height:1px',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(hiddenInput);

  let isFocused = false;

  // mousedown 에서 displayInput 포커스를 막아야 click 이후 hiddenInput.focus() 가 뺏기지 않음
  addListener(displayInput, 'mousedown', (e) => {
    (e as MouseEvent).preventDefault();
  });

  addListener(container, 'click', () => {
    hiddenInput.focus({ preventScroll: true });
  });

  // iOS: touchend 에서 preventDefault 후 즉시 focus — 300ms 딜레이 없이 키보드 열림.
  // getBoundingClientRect 경계 검사: iOS 히트 영역 자동 확장(~40px)으로 container 밖
  // 터치도 이벤트를 수신할 수 있어 시각적 영역 밖 탭을 명시적으로 걸러냄.
  addListener(container, 'touchend', (e) => {
    const touch = (e as TouchEvent).changedTouches?.[0];
    if (touch) {
      const rect = container.getBoundingClientRect();
      if (
        touch.clientX < rect.left ||
        touch.clientX > rect.right ||
        touch.clientY < rect.top ||
        touch.clientY > rect.bottom
      ) return;
    }
    (e as TouchEvent).preventDefault();
    hiddenInput.focus({ preventScroll: true });
  }, { passive: false });

  // 숨김 → 디스플레이 값 동기화
  addListener(hiddenInput, 'input', () => {
    displayInput.value = hiddenInput.value;
    options.onChange?.(hiddenInput.value);
  });

  addListener(hiddenInput, 'focus', () => {
    isFocused = true;
    displayInput.dataset.focused = 'true';
    options.onFocus?.();
  });

  addListener(hiddenInput, 'blur', () => {
    isFocused = false;
    delete displayInput.dataset.focused;
    options.onBlur?.();
  });

  addListener(hiddenInput, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      options.onSubmit?.(hiddenInput.value);
    }
  });

  // suppressLayoutShift: 키보드 등장 시 컨테이너가 키보드에 가려지지 않도록 스크롤
  if (options.suppressLayoutShift !== false && window.visualViewport) {
    addListener(window.visualViewport, 'resize', () => {
      if (!isFocused) return;
      const anchor = options.scrollAnchor ?? 'bottom';
      if (anchor === 'none') return;

      const vp = window.visualViewport!;
      if (anchor === 'bottom') {
        const containerRect = container.getBoundingClientRect();
        const overflow = containerRect.bottom - vp.height;
        if (overflow > 0) {
          window.scrollBy({ top: overflow + 8, behavior: 'instant' as ScrollBehavior });
        }
      } else if (anchor === 'top') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    });
  }

  function focus() { hiddenInput.focus({ preventScroll: true }); }
  function blur() { hiddenInput.blur(); }

  function setValue(value: string) {
    hiddenInput.value = value;
    displayInput.value = value;
  }

  function getValue() { return hiddenInput.value; }

  function destroy() {
    listeners.forEach((off) => off());
    listeners.length = 0;
    displayInput.remove();
    hiddenInput.remove();
  }

  return { focus, blur, setValue, getValue, destroy };
}
