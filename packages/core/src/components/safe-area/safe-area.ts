import type { SafeAreaInsets, SafeAreaOptions, SafeAreaInstance } from './types';

export function createSafeArea(options: SafeAreaOptions = {}): SafeAreaInstance {
  if (typeof window === 'undefined') {
    return {
      getInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
      destroy: () => {},
    };
  }

  // Sentinel element that reads env(safe-area-inset-*) via padding trick
  const sentinel = document.createElement('div');
  sentinel.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';');
  document.body.appendChild(sentinel);

  function readInsets(): SafeAreaInsets {
    const cs = getComputedStyle(sentinel);
    return {
      top: Number.parseFloat(cs.paddingTop) || 0,
      right: Number.parseFloat(cs.paddingRight) || 0,
      bottom: Number.parseFloat(cs.paddingBottom) || 0,
      left: Number.parseFloat(cs.paddingLeft) || 0,
    };
  }

  const listeners: Array<() => void> = [];

  function addListener(
    target: Window,
    type: string,
    handler: EventListener,
  ) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }

  function handleChange() {
    options.onChange?.(readInsets());
  }

  addListener(window, 'orientationchange', handleChange);
  addListener(window, 'resize', handleChange);

  function destroy() {
    for (const off of listeners) off();
    listeners.length = 0;
    sentinel.remove();
  }

  return { getInsets: readInsets, destroy };
}
