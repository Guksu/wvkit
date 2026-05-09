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

  // iOS Safari/WKWebView: overflow:hidden alone doesn't stop scroll.
  // touchmove preventDefault is the only reliable way to block viewport scroll
  // without touching body styles — preserves safe area / notch appearance.
  function preventTouchMove(e: TouchEvent) {
    e.preventDefault();
  }

  function lock() {
    if (locked) return;
    scrollY = window.scrollY;

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

    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
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
