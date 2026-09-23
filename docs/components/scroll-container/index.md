# ScrollContainer

## Problem

Native apps lay panels side by side with the same height, give each panel its own independent vertical scroll, and switch between panels with a top-level horizontal gesture — and users often want pinch-zoom on top of all that. CSS `overflow-x` / `overflow-y` alone cannot deliver this in a WebView. You cannot reliably prevent diagonal scroll, force axis-aligned snap, or compose pinch-zoom with pan using standard scrolling primitives.

`ScrollContainer` solves this by separating what the user *sees* (viewport) from the *content plane* (scene) using a camera abstraction.

## Architecture

Three small parts, no dependencies:

- **Camera model** — a position `(x, y)` and a `zoom`. World units equal CSS pixels at zoom 1.
- **Panel renderer** — places panels absolutely inside one *scene* element and writes the camera as a single CSS transform: `translate(width/2 − x·zoom, height/2 + y·zoom) scale(zoom)`. Panel DOM is untouched, so accessibility and interactivity are preserved, and only one transform changes per frame.
- **CameraControl** — owns all pointer input and moves the camera directly: **axis-constrained pan**, **snap**, **edge resistance**, **pinch zoom**.
- Virtualization: panels outside `activeIndex ± overscan` are hidden with `display:none`; a panel that has never been shown is not attached to the document at all, so its lazy images are not fetched.

Versions before 0.5 rendered the same model through Three.js `CSS3DRenderer`; the public API did not change when that dependency was removed.

The `direction` option no longer means "swipe direction" — it constrains which axis the **camera may pan along**:

- `horizontal`: pan X only — horizontal pager pattern
- `vertical`: pan Y only — vertical pager pattern
- `both`: X+Y free pan *(falls back to `horizontal` in 1.0; diagonal snap policy lands in a follow-up minor)*

## Installation

No peer dependencies. The React/Vue adapters depend on `@guksu/wvkit-core`.

::: code-group
```sh [npm]
npm install @guksu/wvkit-core
# add @guksu/wvkit-react or @guksu/wvkit-vue depending on framework
```
```sh [pnpm]
pnpm add @guksu/wvkit-core
```
:::

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';

const root = document.getElementById('viewport');
const panels = Array.from({ length: 5 }, (_, i) => {
  const el = document.createElement('div');
  el.textContent = `Panel ${i}`;
  return el;
});

const sc = createScrollContainer(root, {
  direction: 'horizontal',
  panels,
  initialIndex: 0,
  overscan: 1,
  snapThreshold: 0.3,
  resistance: 0.2,
  enablePinchZoom: true,
  minZoom: 1,
  maxZoom: 3,
  onIndexChange: (i) => console.log('active panel', i),
  onZoomChange: (z) => console.log('zoom', z),
});

sc.scrollTo(2, { animated: true });
sc.zoomTo(2.0, { animated: true });
sc.destroy();
```

```tsx [React]
import { useMemo } from 'react';
import { useScrollContainer } from '@guksu/wvkit-react/scroll-container';

function Carousel() {
  const panels = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const el = document.createElement('div');
        el.textContent = `Panel ${i}`;
        return el;
      }),
    [],
  );

  const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
    direction: 'horizontal',
    panels,
  });

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 400, position: 'relative', touchAction: 'none' }}
    />
  );
}
```

```vue [Vue]
<script setup>
import { useScrollContainer } from '@guksu/wvkit-vue/scroll-container';

const panels = Array.from({ length: 5 }, (_, i) => {
  const el = document.createElement('div');
  el.textContent = `Panel ${i}`;
  return el;
});

const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
  direction: 'horizontal',
  panels,
});
</script>
<template>
  <div
    ref="containerRef"
    style="width: 100%; height: 400px; position: relative; touch-action: none"
  />
</template>
```

:::

::: tip
Give the host container `touch-action: none` so the browser's own scroll/zoom does not race the pointer pipeline. If you want pinch-zoom handled exclusively by `ScrollContainer`, also set the page viewport meta to `user-scalable=no, maximum-scale=1.0`. Panels that scroll on their own need one more rule — see the next section.
:::

## Scrollable panels (feeds, lists, long content)

A horizontal pager whose panels scroll vertically on their own needs one extra rule: **every scrollable panel must declare `touch-action: pan-y`** (the host container keeps `touch-action: none`).

```js
const panel = document.createElement('div');
panel.style.overflowY = 'auto'; // the panel scrolls its own content
panel.style.touchAction = 'pan-y'; // vertical pans stay native, horizontal pans reach ScrollContainer
```

Why: the browser decides what a touch does by reading `touch-action` from the touched element up to the nearest *scrollable* ancestor — which is the panel itself, so the host's `touch-action: none` is never consulted. With the default `auto` (or `manipulation`) on the panel, the browser also claims horizontal pans, fires `pointercancel`, and the pager never switches. With `pan-y`, vertical touches scroll the panel natively (momentum included), horizontal touches are delivered to the pager, and diagonal touches resolve by their dominant axis, like a native pager.

- `direction: 'vertical'` cannot be combined with panels that scroll vertically: native scroll always wins the gesture. Use fixed-height, non-scrolling panels for a vertical pager.
- Add `loading="lazy"` to images inside panels. Panels outside the `overscan` window are detached from the document, so their lazy images are not fetched until the panel becomes visible.
- Desktop: a mouse drag that starts on an `<img>` begins native drag-and-drop and cancels the gesture. Set `draggable="false"` on images inside panels.

## Pinch zoom and panning while zoomed

- Zooming keeps the point under the fingers fixed (anchor correction), and the camera stays where the gesture ends — it does not snap back to the panel center on release.
- While zoomed, a one-finger pan moves along the pager axis all the way to the panel's edges: the pan bounds grow by `(panelSize / 2) × (1 − 1 / zoom)` on each side.
- Paging while zoomed: drag past the panel edge into the gap before the next panel. If the drag covers more than `snapThreshold` of that gap (velocity counts, as at zoom 1), the camera snaps to the next panel's near edge and `onIndexChange` fires; otherwise it returns to the edge you came from.
- `zoomTo()` clamps the camera into the active panel's range for the new zoom level, so zooming back to 1 lands on the panel center.
- The cross axis (Y for `horizontal`) stays locked at every zoom level — give panels their own native scroll for that axis.

## API Reference

### Options

| Prop              | Type                                       | Default        | Description                                                                                          |
| ----------------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `direction`       | `'horizontal' \| 'vertical' \| 'both'`     | _(required)_   | Camera pan axis constraint. `'both'` falls back to `'horizontal'` in this release.                   |
| `panels`          | `HTMLElement[]`                            | _(required)_   | Pre-built DOM nodes added to the scene as `CSS3DObject`s. Must be non-empty.                         |
| `initialIndex`    | `number`                                   | `0`            | Active panel index at mount. Clamped to `[0, panels.length-1]`.                                      |
| `panelHeight`     | `(index: number) => number`                | _(root height)_ | Per-panel pixel height for `vertical`/`both`. Falls back to root client height.                      |
| `onIndexChange`   | `(index: number) => void`                  | —              | Fired when active panel changes (via `scrollTo` or pan snap).                                        |
| `overscan`        | `number`                                   | `1`            | Number of panels to keep visible on each side of active. `0` mounts only the active panel.           |
| `snapThreshold`   | `number ∈ (0, 1]`                          | `0.3`          | Drag fraction (relative to panel size) required to snap to the next panel.                            |
| `resistance`      | `number ∈ [0, 1]`                          | `0.2`          | Edge rubber-band coefficient. `0` is a hard stop, `1` removes resistance.                            |
| `enablePinchZoom` | `boolean`                                  | `true`         | Whether two-pointer gestures perform pinch zoom.                                                     |
| `minZoom`         | `number > 0`                               | `1.0`          | Minimum zoom level.                                                                                  |
| `maxZoom`         | `number ≥ minZoom`                         | `3.0`          | Maximum zoom level.                                                                                  |
| `onZoomChange`    | `(zoom: number) => void`                   | —              | Fired when zoom level changes.                                                                       |

Invalid options (empty `panels`, `minZoom ≤ 0`, `maxZoom < minZoom`, `snapThreshold ∉ (0,1]`, `resistance ∉ [0,1]`) throw a `WebviewHeadlessError` at construction time.

### Instance Methods

| Method                                    | Returns  | Description                                                                                  |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `scrollTo(index, { animated? })`          | `void`   | Moves to the given panel. `animated` defaults to `true` (eased tween).                       |
| `getActiveIndex()`                        | `number` | Returns the current active panel index.                                                      |
| `zoomTo(level, { animated? })`            | `void`   | Sets the zoom level (clamped). `animated` defaults to `true`.                                |
| `getZoom()`                               | `number` | Returns the current zoom level.                                                              |
| `destroy()`                               | `void`   | Removes all pointer listeners, the renderer DOM, and restores `display` on hidden panels. Idempotent. |

### Framework Adapter Return Values

| Field          | Type (React)                            | Type (Vue)                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`             | `Ref<HTMLElement \| null>`              |
| `activeIndex`  | `number`                                | `Ref<number>`                           |
| `activeZoom`   | `number`                                | `Ref<number>`                           |
| `scrollTo`     | `(i, opts?) => void` (stable callback)  | `(i, opts?) => void`                    |
| `zoomTo`       | `(z, opts?) => void` (stable callback)  | `(z, opts?) => void`                    |

::: warning Non-callback options are captured once at mount
The React hook and Vue composable read non-callback options (e.g. `panels`, `direction`, `minZoom`) once when the instance is created — changing them later is silently ignored. Only callbacks (`onIndexChange`, `onZoomChange`) stay fresh across renders. To swap `panels` (or any other non-callback option), force a remount: change the host component's `key` in React, or use `:key` / `v-if` in Vue.
:::

## Browser Support

| Environment            | Support |
| ---------------------- | ------- |
| iOS Safari 16+         | ✅      |
| WKWebView (iOS)        | ✅      |
| Android Chrome 90+     | ✅      |
| Android WebView        | ✅      |
| Samsung Internet 14+   | ✅      |
| Desktop Chrome/Firefox | ✅      |

## Bundle Size

`ScrollContainer` has no runtime dependencies. Measured with esbuild 0.25 (`--bundle --minify`, gzip -9):

| Bundle | Minified | Gzip |
| --- | --- | --- |
| `@guksu/wvkit-core/scroll-container` | 10.2 KB | 4.1 KB |

Before 0.5 the same component pulled in a tree-shaken subset of Three.js (259 KB minified, 60 KB gzip).

## Limitations

- **`direction: 'both'`** currently falls back to `horizontal` — panels are laid out along the X axis, and pan is X-only. Diagonal snap policy lands in a follow-up minor release.
- **`panels` are `HTMLElement[]`, not React/Vue children.** Build the DOM nodes imperatively (e.g. `document.createElement`) and pass the array. A render-prop / `<PanelGroup>` higher-level API is on the roadmap.
- **Virtualization toggles `panel.style.display`** on the panel root (and sets `position`, `transform`, `user-select` and `draggable` on it). If your panel content also sets those on the root, they will collide — keep your own styles on a child element instead of the panel root.
- **Options are fixed at mount.** Reactive option changes (e.g. flipping `direction` at runtime in a framework adapter) require remounting the component. Use a `key` prop on the wrapper.
- **Pinch-zoom relies on `PointerEvent` and the `touch-action: none` CSS hint.** Browsers without `PointerEvent` (very old WebView versions) will silently skip pinch.
- **`setPointerCapture` is not available in every WebView build.** The implementation is guarded with `try/catch`; in environments without capture support, pointer-leaving-root during a drag may cause the gesture to be released early.
- **`position: fixed` inside a panel does not stick to the viewport.** Panels are CSS-transformed, so `fixed` descendants resolve against the panel and scroll with it. Render fixed overlays outside the host container.
- **Mouse drag over an `<img>` starts native drag-and-drop** (desktop), which cancels the gesture — set `draggable="false"` on images inside panels.
- **Cross-axis pan while zoomed is not supported** — the axis excluded by `direction` stays locked even when zoomed in.
- **No wheel, trackpad, or keyboard input.** Only a pointer drag switches panels. Arrow keys, wheel, and ARIA roles are not wired — provide your own controls that call `scrollTo()`.
- **No momentum on the pager axis.** Release always runs a fixed 300 ms ease-out tween to the snap target; a fling never carries across several panels.
- **Text inside panels cannot be selected.** `CSS3DObject` sets `user-select: none` (and `draggable="false"`) on every panel element. Inputs inside panels still work.
- **Panel DOM is never unmounted.** Virtualization only detaches or hides panels outside the `overscan` window; every panel stays in memory for the life of the instance. Virtualize long lists inside panels yourself.
- **Each visible scrollable panel is its own compositor layer** (browsers composite scroll containers). With `overscan: 1` three such layers are alive at once. Measured in headless Chromium, a 150-image feed panel became a 412 × 47,773 px layer. Keep `overscan` small on low-end devices.
- **Scroll position of a hidden panel survives in Chromium** (verified across a `display: none` round-trip) **but is unverified in WebKit.** Test on iOS before relying on it.
- **`scrollTo(index)` while zoomed lands on the panel center**, not on the edge you were looking at.
