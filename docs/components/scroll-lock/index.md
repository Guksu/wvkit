# useScrollLock

## Problem

When a modal or bottom sheet opens in a WebView app, the underlying page should not be scrollable. A simple `overflow: hidden` on `<body>` does not reliably prevent scroll on iOS Safari or WKWebView — users can still swipe the page behind the modal.

`useScrollLock` uses the `position: fixed` + `top` offset technique, which is the only approach that reliably blocks body scroll on all WebView environments including iOS.

## Installation

::: code-group
```sh [npm]
npm install @wvkit/core
```
```sh [pnpm]
pnpm add @wvkit/core
```
:::

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createScrollLock } from '@wvkit/core';

const scrollLock = createScrollLock({
  onLock: () => console.log('locked'),
  onUnlock: () => console.log('unlocked'),
});

// Open modal
scrollLock.lock();

// Close modal
scrollLock.unlock();

// Cleanup
scrollLock.destroy();
```

```tsx [React]
import { useScrollLock } from '@wvkit/react';

function Modal({ isOpen, onClose }) {
  const { lock, unlock } = useScrollLock();

  useEffect(() => {
    if (isOpen) lock();
    else unlock();
  }, [isOpen]);

  return isOpen ? <div className="modal">...</div> : null;
}
```

```vue [Vue]
<script setup>
import { watch } from 'vue';
import { useScrollLock } from '@wvkit/vue';

const props = defineProps(['isOpen']);
const { lock, unlock } = useScrollLock();

watch(() => props.isOpen, (open) => {
  if (open) lock();
  else unlock();
});
</script>
```

:::

## How It Works

On `lock()`:
1. Saves the current `window.scrollY`
2. Sets `document.body` to `position: fixed; top: -<scrollY>px; overflow: hidden; width: 100%`

On `unlock()`:
1. Restores `document.body` styles
2. Calls `window.scrollTo(0, scrollY)` to restore the previous scroll position

This prevents the page from jumping to the top when the modal is closed.

## API Reference

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onLock` | `() => void` | `undefined` | Called when scroll is locked |
| `onUnlock` | `() => void` | `undefined` | Called when scroll is unlocked |
| `allowScrollWithin` | `string \| HTMLElement` | `undefined` | Area (CSS selector or element) where touch scrolling stays enabled while locked — use it to keep a modal/bottom-sheet's inner scroll region working |

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `lock()` | `void` | Locks body scroll. No-op if already locked |
| `unlock()` | `void` | Unlocks body scroll and restores scroll position. No-op if not locked |
| `isLocked` | `boolean` | Current lock state (getter) |
| `destroy()` | `void` | Unlocks if locked and cleans up |

## Browser Support

| Environment | Support |
|-------------|---------|
| iOS Safari 15+ | ✅ |
| WKWebView (iOS) | ✅ |
| Android Chrome 90+ | ✅ |
| Android WebView | ✅ |
| Samsung Internet 14+ | ✅ |
| Desktop Chrome/Firefox | ✅ |

## Limitations

- Without `allowScrollWithin`, every `touchmove` is prevented while locked — scrollable regions inside your modal will also freeze on touch devices. Pass the modal's scroll container to keep it working.
- On iOS, a touch inside the allowed area can still rubber-band the page when the inner scroller is at its edge (overscroll chaining). Apply `overscroll-behavior: contain` to the allowed element to mitigate.
- Directly modifies `document.body` styles — avoid combining with other libraries that also manipulate body styles while locked.
- Multiple concurrent `createScrollLock` instances will conflict. Use a single instance and share it, or use a lock-count pattern at the application level.
- In SSR environments all methods are no-ops.
