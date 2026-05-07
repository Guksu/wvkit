# useSafeArea

## Problem

WebView apps running on notched or Dynamic Island devices need to account for safe area insets (top bar, home indicator, rounded corners). The CSS `env(safe-area-inset-*)` values exist but are not exposed to JavaScript by default, making it impossible to drive layout logic or animations from these values at runtime.

`useSafeArea` reads those CSS env values into JavaScript and keeps them updated on orientation change and resize.

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
import { createSafeArea } from '@wvkit/core';

const instance = createSafeArea({
  onChange: ({ top, bottom, left, right }) => {
    document.documentElement.style.setProperty('--sat', `${top}px`);
    document.documentElement.style.setProperty('--sab', `${bottom}px`);
  },
});

console.log(instance.getInsets()); // { top: 47, right: 0, bottom: 34, left: 0 }

instance.destroy();
```

```tsx [React]
import { useSafeArea } from '@wvkit/react';

function Layout({ children }) {
  const { top, bottom } = useSafeArea();
  return (
    <div style={{ paddingTop: top, paddingBottom: bottom }}>
      {children}
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { useSafeArea } from '@wvkit/vue';
const insets = useSafeArea();
</script>
<template>
  <div :style="{ paddingTop: insets.top + 'px', paddingBottom: insets.bottom + 'px' }">
    <slot />
  </div>
</template>
```

:::

## How It Works

A hidden sentinel `<div>` is appended to `document.body` with its padding set to the `env(safe-area-inset-*)` values. `getComputedStyle` is then used to read the resolved pixel values. The sentinel is removed on `destroy()`.

Your HTML must include the `viewport-fit=cover` meta tag for env values to be non-zero:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## API Reference

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(insets: SafeAreaInsets) => void` | `undefined` | Called whenever insets change (orientation/resize) |

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getInsets()` | `SafeAreaInsets` | Returns current `{ top, right, bottom, left }` in pixels |
| `destroy()` | `void` | Removes event listeners and sentinel element |

### `SafeAreaInsets`

```ts
interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

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

- Requires `viewport-fit=cover` in the viewport meta tag; without it all values are `0`.
- Values are `0` in SSR environments — insets are read on mount only.
- Orientation change events may fire slightly before layout reflow completes; a single `requestAnimationFrame` delay can help if you observe stale values.
