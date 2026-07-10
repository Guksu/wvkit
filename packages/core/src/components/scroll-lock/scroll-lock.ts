import type { ScrollLockOptions, ScrollLockInstance } from './types';

export function createScrollLock(options: ScrollLockOptions = {}): ScrollLockInstance {
  if (typeof window === 'undefined') {
    return {
      lock: () => {},
      unlock: () => {},
      get isLocked() { return false; },
      destroy: () => {},
    };
  }

  let scrollY = 0;
  let locked = false;
  let prevOverflow = '';
  let prevOverscrollBehavior = '';

  function isWithinAllowedArea(target: EventTarget | null): boolean {
    const allowed = options.allowScrollWithin;
    if (!allowed || !(target instanceof Element)) return false;
    if (typeof allowed === 'string') return target.closest(allowed) !== null;
    return allowed.contains(target);
  }

  // iOS Safari/WKWebView: overflow:hidden alone doesn't stop scroll.
  // touchmove preventDefault is the only reliable way to block viewport scroll
  // without touching body styles — preserves safe area / notch appearance.
  function preventTouchMove(e: TouchEvent) {
    // allowScrollWithin 영역(모달/바텀시트 내부 스크롤러)의 터치는 통과
    if (isWithinAllowedArea(e.target)) return;
    e.preventDefault();
  }

  function lock() {
    if (locked) return;
    scrollY = window.scrollY;

    // 소비자가 지정해둔 인라인 값을 unlock 시 그대로 복원하기 위해 보관
    prevOverflow = document.body.style.overflow;
    prevOverscrollBehavior = document.body.style.overscrollBehavior;

    // Android WebView / desktop: overflow:hidden blocks scroll
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    // iOS WKWebView: prevent touchmove at document level (passive:false required)
    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    locked = true;
    options.onLock?.();
  }

  function unlock() {
    if (!locked) return;

    document.body.style.overflow = prevOverflow;
    document.body.style.overscrollBehavior = prevOverscrollBehavior;
    document.removeEventListener('touchmove', preventTouchMove);

    window.scrollTo(0, scrollY);
    locked = false;
    options.onUnlock?.();
  }

  function destroy() {
    unlock();
  }

  return {
    lock,
    unlock,
    get isLocked() { return locked; },
    destroy,
  };
}
