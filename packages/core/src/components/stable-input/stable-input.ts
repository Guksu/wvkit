import { WebviewHeadlessError } from '../../errors';
import type { StableInputOptions, StableInputInstance } from './types';

const SCROLL_ANCHORS = ['top', 'bottom', 'none'] as const;

/**
 * 옵션 검증 — 잘못된 값은 즉시 `WebviewHeadlessError`로 차단해 디버깅 시간을 줄인다.
 * TypeScript 시그니처로는 잡히지 않는 위반만 검사 (ScrollContainer/PTR과 동일 컨벤션).
 * `type`/`placeholder`/`inputMode`/`autocomplete`는 임의 문자열이 그대로 유효해
 * 런타임 검증의 실익이 없으므로 의도적으로 생략한다.
 * 반드시 SSR 가드 통과 뒤에 호출할 것 — `HTMLElement` 전역이 SSR 환경에는 없다.
 */
function validateOptions(container: HTMLElement, options: StableInputOptions): void {
  if (!(container instanceof HTMLElement)) {
    throw new WebviewHeadlessError('StableInput: container must be an HTMLElement');
  }
  if (options.scrollAnchor !== undefined && !SCROLL_ANCHORS.includes(options.scrollAnchor)) {
    throw new WebviewHeadlessError(
      `StableInput: scrollAnchor must be 'top', 'bottom', or 'none' (got ${options.scrollAnchor})`,
    );
  }
}

export function createStableInput(
  container: HTMLElement,
  options: StableInputOptions,
): StableInputInstance {
  if (typeof window === 'undefined') {
    return { focus: () => {}, blur: () => {}, setValue: () => {}, getValue: () => '', destroy: () => {} };
  }

  validateOptions(container, options);

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

  // 탭과 스크롤 제스처 구분: touchstart 좌표를 기록해 두고, touchend까지의
  // 이동 거리가 TAP_SLOP을 넘으면 스크롤로 간주해 포커스하지 않는다.
  // 없으면 인풋 위에서 시작한 리스트 스크롤이 끝날 때 키보드가 열리는 오동작 발생.
  const TAP_SLOP = 10;
  let touchStart: { x: number; y: number } | null = null;
  addListener(container, 'touchstart', (e) => {
    const touch = (e as TouchEvent).touches?.[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });

  // iOS: touchend 에서 preventDefault 후 즉시 focus — 300ms 딜레이 없이 키보드 열림.
  // getBoundingClientRect 경계 검사: iOS 히트 영역 자동 확장(~40px)으로 container 밖
  // 터치도 이벤트를 수신할 수 있어 시각적 영역 밖 탭을 명시적으로 걸러냄.
  addListener(container, 'touchend', (e) => {
    const touch = (e as TouchEvent).changedTouches?.[0];
    if (touch) {
      const start = touchStart;
      touchStart = null;
      if (
        start &&
        (Math.abs(touch.clientX - start.x) > TAP_SLOP ||
          Math.abs(touch.clientY - start.y) > TAP_SLOP)
      ) return;
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
    const kev = e as KeyboardEvent;
    // IME 조합 확정용 Enter는 제출로 취급하지 않음 — 한글 등 조합형 입력에서
    // 마지막 글자를 확정하는 Enter로 onSubmit이 조기 발화하는 것을 방지.
    // keyCode 229는 isComposing을 제대로 채우지 않는 구형 WebView/Safari 대응.
    if (kev.isComposing || kev.keyCode === 229) return;
    if (kev.key === 'Enter') {
      options.onSubmit?.(hiddenInput.value);
    }
  });

  // suppressLayoutShift: 키보드 등장 시 컨테이너가 키보드에 가려지지 않도록 스크롤
  if (options.suppressLayoutShift !== false && window.visualViewport) {
    addListener(window.visualViewport, 'resize', () => {
      if (!isFocused) return;
      const anchor = options.scrollAnchor ?? 'bottom';
      if (anchor === 'none') return;

      const vp = window.visualViewport;
      if (!vp) return;
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
    for (const off of listeners) off();
    listeners.length = 0;
    // 리스너·DOM뿐 아니라 상태도 초기값으로 — destroy 후 잔존 상태 없음 (destroy 패턴 컨벤션)
    isFocused = false;
    displayInput.remove();
    hiddenInput.remove();
  }

  return { focus, blur, setValue, getValue, destroy };
}
