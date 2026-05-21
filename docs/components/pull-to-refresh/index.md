# PullToRefresh

## Problem

WebView and iOS Safari ship with a native pull-to-refresh on the viewport plus elastic bounce — neither of which can be customized. CSS alone cannot reproduce a *native-feeling* PTR inside a scrollable region: you cannot reliably gate the gesture to "only when scrolled to the top", apply resistance, or run an async refresh in the middle.

`PullToRefresh` is a **headless** primitive that owns the gesture state machine (`idle → pulling → armed → refreshing → resetting → idle`), the resistance math, and the `overscroll-behavior` plumbing. You render the indicator yourself from the exposed `state` / `distance` / `progress` values.

## Installation

```sh
pnpm add @wvkit/core
# add @wvkit/react or @wvkit/vue depending on framework
```

No additional peer dependencies — `PullToRefresh` ships with zero runtime deps in `@wvkit/core`.

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createPullToRefresh } from '@wvkit/core';

const list = document.getElementById('list');
const ptr = createPullToRefresh(list, {
  onRefresh: async () => {
    await fetch('/api/items').then((r) => r.json()).then(setItems);
  },
  threshold: 60,
  onStateChange: (state) => updateIndicator(state),
  onPull: (distance, progress) => positionIndicator(distance, progress),
});

ptr.trigger();   // manual external refresh
ptr.destroy();
```

```tsx [React]
import { usePullToRefresh } from '@wvkit/react';

function FeedList() {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: async () => {
      await new Promise((r) => setTimeout(r, 1500));
      // prepend fresh items into local state
    },
  });

  const indicatorText =
    state === 'armed' ? '↑ Release to refresh' :
    state === 'refreshing' ? '⟳ Refreshing…' :
    state === 'pulling' ? `↓ Pull (${Math.round(progress * 100)}%)` :
    '';

  return (
    <div style={{ position: 'relative', height: 400, overflow: 'hidden' }}>
      {/* You own the indicator render — headless */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 60,
          transform: `translateY(${distance - 60}px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {indicatorText}
      </div>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', touchAction: 'pan-y' }}
      >
        {/* list content */}
      </div>
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { usePullToRefresh } from '@wvkit/vue';

const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
  onRefresh: async () => {
    await fetch('/api/items').then((r) => r.json());
  },
});
</script>
<template>
  <div style="position: relative; height: 400px; overflow: hidden">
    <div
      :style="{
        position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
        transform: `translateY(${distance - 60}px)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }"
    >
      {{ state === 'armed' ? '↑ Release to refresh'
       : state === 'refreshing' ? '⟳ Refreshing…'
       : state === 'pulling' ? `↓ Pull (${Math.round(progress * 100)}%)`
       : '' }}
    </div>
    <div
      ref="containerRef"
      style="position: absolute; inset: 0; overflow-y: auto; touch-action: pan-y"
    >
      <!-- list content -->
    </div>
  </div>
</template>
```

:::

::: tip
Pair `touch-action: pan-y` on the scroll container with a page viewport meta of `user-scalable=no` if you want pinch-zoom out of the picture. `PullToRefresh` only handles vertical pulls — horizontal scroll/pan is left untouched.
:::

## API Reference

### State

```ts
type PullToRefreshState = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'resetting';
```

Transitions:

```
idle      → (touchstart at scrollTop=0, enabled)  → pulling
pulling   → (distance ≥ threshold)                → armed
armed     → (distance < threshold during move)    → pulling
pulling   → (release, distance < threshold)       → resetting → idle
armed     → (release)                              → refreshing
refreshing→ (onRefresh resolved/returned)         → resetting → idle
refreshing→ (onRefresh rejected/threw)            → console.error + resetting → idle
```

### Options

| Prop                       | Type                                       | Default | Description                                                                                            |
| -------------------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `onRefresh`                | `() => Promise<void> \| void`              | _(required)_ | Refresh callback. Promise → state stays `refreshing` until resolved. Void → immediate reset.            |
| `threshold`                | `number`                                   | `60`    | Distance (px, after resistance) required to arm the refresh.                                            |
| `maxDistance`              | `number`                                   | `120`   | Hard cap on the pulled distance. Must be ≥ `threshold`.                                                |
| `resistance`               | `number ∈ [0, 1]`                          | `0.5`   | Damping coefficient. `0` is no resistance, `1` is strong dampening.                                    |
| `enabled`                  | `boolean`                                  | `true`  | Master toggle. `false` blocks new pulls; in-flight gestures complete.                                  |
| `disableOverscrollContain` | `boolean`                                  | `false` | Opt out of the automatic `overscroll-behavior: contain` applied to the root.                            |
| `onStateChange`            | `(state: PullToRefreshState) => void`      | —       | Fired on every state transition (deduped against the previous value).                                  |
| `onPull`                   | `(distance: number, progress: number) => void` | —   | Fired on every distance update during pull or reset. `progress = distance / threshold`.                 |

Invalid options (`threshold ≤ 0`, `maxDistance < threshold`, `resistance ∉ [0,1]`) throw a `WebviewHeadlessError` at construction.

### Instance Methods

| Method                   | Returns          | Description                                                                                |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| `destroy()`              | `void`           | Removes all pointer/touch listeners, cancels in-flight tweens, restores `overscroll-behavior`. Idempotent. |
| `getState()`             | `PullToRefreshState` | Returns the current state machine value.                                                |
| `trigger()`              | `Promise<void>`  | Forces a refresh externally. While one refresh is in flight, returns the same Promise.    |
| `setEnabled(enabled)`    | `void`           | Toggles `enabled`. In-flight gestures continue.                                            |

### Framework Adapter Return Values

| Field          | Type (React)                          | Type (Vue)                            |
| -------------- | ------------------------------------- | ------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`           | `Ref<HTMLElement \| null>`            |
| `state`        | `PullToRefreshState`                  | `Ref<PullToRefreshState>`             |
| `distance`     | `number`                              | `Ref<number>`                         |
| `progress`     | `number`                              | `Ref<number>`                         |
| `trigger`      | `() => Promise<void>` (stable)        | `() => Promise<void>`                 |
| `setEnabled`   | `(enabled: boolean) => void` (stable) | `(enabled: boolean) => void`          |

## Browser Support

| Environment            | Support |
| ---------------------- | ------- |
| iOS Safari 15+         | ✅      |
| WKWebView (iOS)        | ✅      |
| Android Chrome 90+     | ✅      |
| Android WebView        | ✅      |
| Samsung Internet 14+   | ✅      |
| Desktop Chrome/Firefox | ✅      |

## Limitations

- **Attach target is a single `HTMLElement` (D1).** `window`/`body`-level PTR is *not* supported as a first-class API. If you need it, you can pass `document.body` as the root — but Safari's own viewport PTR may still race; we don't guarantee parity.
- **`overscroll-behavior: contain` is auto-applied (D3).** This prevents the gesture from chaining into the parent scroll. iOS *elastic bounce* is intentionally **not** blocked — passing `disableOverscrollContain: true` opts out entirely if you need to manage the policy yourself.
- **No integration with ScrollContainer (D5).** The two components are independent. You can attach `PullToRefresh` to an `overflow-y: auto` div *inside* a ScrollContainer panel, but the gesture won't compose with ScrollContainer's camera pan.
- **`onRefresh` errors are swallowed (D6).** Promise rejection or synchronous throws are logged via `console.error` and the state returns to `idle`. There is no `'error'` state — surface error UI yourself by tracking `onRefresh` outcome.
- **Pull direction is vertical only.** Horizontal swipes are ignored. Diagonal pulls are treated as vertical based on the Y component.
- **`PointerEvent` and `TouchEvent` are both wired**, gated by an `activeSource` flag so iOS browsers (which synthesize pointer events from touch) don't double-handle the same gesture. Very old WebView builds without `PointerEvent` still work via the `TouchEvent` path.
