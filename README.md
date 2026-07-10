# wvkit

[한국어](README.ko.md)

[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-core?label=%40guksu%2Fwvkit-core)](https://www.npmjs.com/package/@guksu/wvkit-core)
[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-react?label=%40guksu%2Fwvkit-react)](https://www.npmjs.com/package/@guksu/wvkit-react)
[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-vue?label=%40guksu%2Fwvkit-vue)](https://www.npmjs.com/package/@guksu/wvkit-vue)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![Demo](https://img.shields.io/badge/demo-live-4f46e5)](https://guksu.github.io/wvkit/)

> Headless UI primitives for WebView — solving layout, scroll, and input problems that general-purpose UI libraries ignore.

---

## Why wvkit?

WebView apps running inside native shells face a category of UI bugs that browser-first libraries never handle:

- **iOS keyboard causes the entire layout to jump** — `visualViewport` resize and scroll fire simultaneously on focus
- **Pager-style horizontal scroll with independent vertical panels** — `overflow-x/y` CSS alone can't enforce axis locking, snapping, or pinch zoom composition
- **Pull-to-refresh conflicts with native elastic bounce** — WebView's built-in overscroll behavior can't be customized with CSS
- **Safe-area insets change on rotation** — `env(safe-area-inset-*)` values aren't exposed to JavaScript reactively
- **Soft keyboard open/close has no reliable cross-platform event** — iOS and Android each require different heuristics

wvkit handles all of these. Each component exposes only **behavior** — no default styles, no opinions on design — so your team can layer its own design system on top.

---

## Features

| Component | Package | Description |
|-----------|---------|-------------|
| `ScrollContainer` | core / react / vue | Horizontal/vertical viewport pager with pinch zoom. Powered by Three.js CSS3DRenderer + OrthographicCamera for axis-locked pan, snap, edge resistance, and panel virtualization. |
| `StableInput` | core / react / vue | iOS keyboard layout-shift prevention. Dual-input architecture (display + hidden fixed) with `visualViewport` listener to suppress jumping. |
| `PullToRefresh` | core / react / vue | Headless pull-to-refresh state machine (`idle → pulling → armed → refreshing → resetting`). Resistance curve, async refresh, native PTR suppression via `overscroll-behavior: contain`. |
| `useVirtualKeyboard` | core / react / vue | Infers soft keyboard open/close state from `visualViewport` resize delta. iOS and Android heuristics built in. |
| `useSafeArea` | core / react / vue | Reads `env(safe-area-inset-*)` CSS values into JavaScript. Reactive on device orientation change. |
| `useScrollLock` | core / react / vue | Prevents `<body>` scroll without layout shift (uses `overflow: hidden` + scroll position preservation). |

---

## Installation

### Core (Vanilla JS / framework-agnostic)

```bash
npm install @guksu/wvkit-core
# ScrollContainer requires three as a peer dependency
npm install three
```

### React

```bash
npm install @guksu/wvkit-react @guksu/wvkit-core
npm install three        # required by ScrollContainer
```

### Vue 3

```bash
npm install @guksu/wvkit-vue @guksu/wvkit-core
npm install three        # required by ScrollContainer
```

> If you don't use `ScrollContainer`, you can skip `three`.

---

## Quick Start

### PullToRefresh

**Core**
```ts
import { createPullToRefresh } from '@guksu/wvkit-core';

const ptr = createPullToRefresh(containerEl, {
  onRefresh: async () => {
    await fetchData();
  },
  threshold: 60,
  resistance: 0.5,
  onStateChange: (state) => console.log(state),
  onPull: (distance, progress) => {
    indicator.style.transform = `translateY(${distance}px)`;
    indicator.style.opacity = String(progress);
  },
});

// Cleanup
ptr.destroy();
```

**React**
```tsx
import { usePullToRefresh } from '@guksu/wvkit-react';

function Feed() {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: async () => { await fetchFeed(); },
  });

  return (
    <div ref={containerRef} style={{ height: '100vh', overflowY: 'auto' }}>
      {/* Your custom indicator — progress goes 0 → 1 → beyond */}
      <div style={{ opacity: progress, transform: `translateY(${distance}px)` }}>
        {state === 'refreshing' ? '새로고침 중...' : '당겨서 새로고침'}
      </div>
      <YourContent />
    </div>
  );
}
```

**Vue**
```vue
<script setup lang="ts">
import { usePullToRefresh } from '@guksu/wvkit-vue';

const { containerRef, state, distance, progress } = usePullToRefresh({
  onRefresh: async () => { await fetchFeed(); },
});
</script>

<template>
  <div ref="containerRef">
    <div :style="{ opacity: progress, transform: `translateY(${distance}px)` }">
      {{ state === 'refreshing' ? '새로고침 중...' : '당겨서 새로고침' }}
    </div>
    <YourContent />
  </div>
</template>
```

---

### StableInput

**Core**
```ts
import { createStableInput } from '@guksu/wvkit-core';

const input = createStableInput(containerEl, {
  placeholder: 'Search…',
  onFocus: () => header.classList.add('hidden'),
  onBlur: () => header.classList.remove('hidden'),
  onChange: (value) => search(value),
  onSubmit: (value) => navigate(value),
});

input.focus();
input.setValue('hello');
input.destroy();
```

**React**
```tsx
import { useStableInput, StableInputDisplay } from '@guksu/wvkit-react';

function SearchBar() {
  const inputProps = useStableInput({
    onChange: (value) => search(value),
    onSubmit: (value) => navigate(value),
  });

  return <StableInputDisplay {...inputProps} className="my-search-input" />;
}
```

**Vue**
```vue
<script setup lang="ts">
import { useStableInput } from '@guksu/wvkit-vue';

const { containerRef, value, isFocused, focus, blur, setValue } = useStableInput({
  onChange: (v) => search(v),
});
</script>
```

---

### ScrollContainer

```ts
import { createScrollContainer } from '@guksu/wvkit-core';

const sc = createScrollContainer(rootEl, {
  direction: 'horizontal',
  panels: panelElements,
  initialIndex: 0,
  enablePinchZoom: true,
  minZoom: 1.0,
  maxZoom: 3.0,
  onIndexChange: (index) => setTab(index),
  onZoomChange: (zoom) => setZoomLabel(zoom),
});

sc.scrollTo(2, { animated: true });
sc.zoomTo(1.5, { animated: true });
sc.destroy();
```

---

### Utility Hooks

```ts
// Virtual keyboard state
import { createVirtualKeyboard } from '@guksu/wvkit-core';
const kb = createVirtualKeyboard(el, {
  onKeyboardChange: ({ isOpen, keyboardHeight }) => {
    bottomBar.style.transform = isOpen ? `translateY(-${keyboardHeight}px)` : '';
  },
});

// Safe area insets
import { createSafeArea } from '@guksu/wvkit-core';
const sa = createSafeArea(el, {
  onChange: ({ top, bottom }) => {
    header.style.paddingTop = `${top}px`;
    footer.style.paddingBottom = `${bottom}px`;
  },
});

// Scroll lock
import { createScrollLock } from '@guksu/wvkit-core';
const lock = createScrollLock(el, {});
lock.lock();
lock.unlock();
```

---

## API Reference

### PullToRefresh

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onRefresh` | `() => Promise<void> \| void` | — | Refresh callback. Stays in `refreshing` until Promise resolves. |
| `threshold` | `number` | `60` | Pull distance (px) to trigger refresh. |
| `maxDistance` | `number` | `120` | Maximum pull distance (px). |
| `resistance` | `number` | `0.5` | Resistance coefficient (0–1). |
| `enabled` | `boolean` | `true` | Enable/disable. |
| `disableOverscrollContain` | `boolean` | `false` | Opt out of automatic `overscroll-behavior: contain`. |
| `onStateChange` | `(state) => void` | — | State machine transition callback. |
| `onPull` | `(distance, progress) => void` | — | Pull distance update callback. |

### StableInput

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `string` | `'text'` | Input type. |
| `placeholder` | `string` | — | Placeholder text. |
| `suppressLayoutShift` | `boolean` | `true` | Activate `visualViewport` listener. |
| `scrollAnchor` | `'top' \| 'bottom' \| 'none'` | `'bottom'` | Scroll anchor on keyboard open. |
| `onChange` | `(value: string) => void` | — | Value change callback. |
| `onSubmit` | `(value: string) => void` | — | Submit callback (Enter key). |

### ScrollContainer

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `'horizontal' \| 'vertical' \| 'both'` | `'horizontal'` | Camera pan axis constraint. |
| `panels` | `HTMLElement[]` | — | Panel elements to display. |
| `initialIndex` | `number` | `0` | Initially active panel index. |
| `enablePinchZoom` | `boolean` | `true` | Enable pinch-to-zoom. |
| `minZoom` | `number` | `1.0` | Minimum zoom level. |
| `maxZoom` | `number` | `3.0` | Maximum zoom level. |
| `overscan` | `number` | `1` | Panels to keep mounted outside viewport. |
| `snapThreshold` | `number` | `0.3` | Swipe ratio to trigger snap. |
| `resistance` | `number` | `0.2` | Edge rubber-band resistance. |
| `onIndexChange` | `(index: number) => void` | — | Active panel change callback. |
| `onZoomChange` | `(zoom: number) => void` | — | Zoom level change callback. |

---

## Browser / WebView Support

| Environment | ScrollContainer | StableInput | PullToRefresh | VirtualKeyboard | SafeArea |
|-------------|:-:|:-:|:-:|:-:|:-:|
| iOS Safari 16+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WKWebView (iOS 16+) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Android Chrome 90+ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Android WebView | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Samsung Internet | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Desktop Chrome / Firefox | ✅ | ✅ | ✅ | — | — |

> ⚠️ Partial support or requires manual testing. SafeArea depends on the host native app passing `viewport-fit=cover`.

---

## Design Principles

- **Headless** — behavior only, zero default styles
- **SSR-safe** — no `window`/`document` access at module load time
- **Minimal runtime deps** — `three` is a peer dependency (tree-shaken, host-provided)
- **Framework-agnostic core** — React and Vue adapters are thin wrappers around the same core logic
- **destroy pattern** — every factory function returns a `destroy()` method that cleans up all listeners and DOM references

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Watch mode
pnpm dev

# Run all tests
pnpm test

# Type check
pnpm typecheck

# Lint + format
pnpm lint
pnpm format

# Add a changeset before releasing
pnpm changeset

# Bump versions and publish
pnpm changeset version
pnpm changeset publish
```

---

## License

MIT © [Guksu](https://github.com/Guksu)
