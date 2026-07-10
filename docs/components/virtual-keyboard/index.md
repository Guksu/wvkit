# useVirtualKeyboard

## Problem

WebView apps need to know when the soft keyboard opens or closes to adjust layout manually — for example, pushing a chat input above the keyboard or revealing hidden content. There is no reliable cross-platform event for this. `window.resize` fires inconsistently on iOS, and `visualViewport` is not universally supported.

`useVirtualKeyboard` detects keyboard state by comparing the current `visualViewport.height` against the baseline height captured on mount, with platform-aware fallbacks.

## Installation

::: code-group
```sh [npm]
npm install @guksu/wvkit-core
```
```sh [pnpm]
pnpm add @guksu/wvkit-core
```
:::

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createVirtualKeyboard } from '@guksu/wvkit-core';

const instance = createVirtualKeyboard({
  onChange: ({ isOpen, keyboardHeight }) => {
    document.getElementById('chat-bar').style.transform =
      isOpen ? `translateY(-${keyboardHeight}px)` : '';
  },
});

instance.destroy();
```

```tsx [React]
import { useVirtualKeyboard } from '@guksu/wvkit-react';

function ChatLayout() {
  const { isOpen, keyboardHeight } = useVirtualKeyboard();
  return (
    <div style={{ paddingBottom: isOpen ? keyboardHeight : 0 }}>
      {/* content */}
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { useVirtualKeyboard } from '@guksu/wvkit-vue';
const { isOpen, keyboardHeight } = useVirtualKeyboard();
</script>
<template>
  <div :style="{ paddingBottom: isOpen ? keyboardHeight + 'px' : 0 }">
    <!-- content -->
  </div>
</template>
```

:::

## How It Works

1. Captures `visualViewport.height` (or `window.innerHeight`) as `baseHeight` on mount.
2. Listens to `visualViewport.resize` (falls back to `window.resize`).
3. On each event: `delta = baseHeight - currentHeight`. If `delta > threshold` → keyboard is open.
4. `keyboardHeight` is set to `delta` when open, `0` when closed.

## API Reference

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(state: VirtualKeyboardState) => void` | `undefined` | Called when keyboard state changes |
| `threshold` | `number` | `100` | Minimum height change (px) to consider keyboard open |

### Instance

| Member | Type | Description |
|--------|------|-------------|
| `isOpen` | `boolean` (getter) | Whether the keyboard is currently open |
| `keyboardHeight` | `number` (getter) | Estimated keyboard height in pixels |
| `destroy()` | `void` | Removes all event listeners |

### `VirtualKeyboardState`

```ts
interface VirtualKeyboardState {
  isOpen: boolean;
  keyboardHeight: number;
}
```

## Browser Support

| Environment | Support |
|-------------|---------|
| iOS Safari 15+ | ✅ (via `visualViewport`) |
| WKWebView (iOS) | ✅ (via `visualViewport`) |
| Android Chrome 62+ | ✅ (via `visualViewport`) |
| Android WebView | ✅ (via `window.resize` fallback) |
| Samsung Internet 14+ | ✅ |
| Desktop | ✅ (keyboard never opens → always `isOpen: false`) |

## Limitations

- Height-based inference: split-screen, floating keyboard, or browser toolbar changes can trigger false positives. Tune `threshold` to reduce these.
- `keyboardHeight` is an estimate derived from viewport shrinkage — it may not exactly match the native keyboard height on all devices.
- `baseHeight` is set on mount, but self-heals: whenever the viewport grows past the baseline (e.g. the keyboard closes), the baseline is updated — so creating an instance while the keyboard is already open only misses that first keyboard session.
- Android WebView in `adjustPan` mode (`android:windowSoftInputMode`) does not resize the viewport when the keyboard opens — neither `visualViewport` nor `window.resize` fires, so detection is impossible. The host app must use `adjustResize`.
- In SSR environments all values are `{ isOpen: false, keyboardHeight: 0 }`.
