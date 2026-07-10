# ScrollContainer

## Problem

Native apps lay panels side by side with the same height, give each panel its own independent vertical scroll, and switch between panels with a top-level horizontal gesture — and users often want pinch-zoom on top of all that. CSS `overflow-x` / `overflow-y` alone cannot deliver this in a WebView. You cannot reliably prevent diagonal scroll, force axis-aligned snap, or compose pinch-zoom with pan using standard scrolling primitives.

`ScrollContainer` solves this by separating what the user *sees* (viewport) from the *content plane* (scene) using a camera abstraction.

## Architecture

Built on **[Three.js](https://threejs.org/) + `CSS3DRenderer` + `OrthographicCamera`** plus a custom **CameraControl**:

- Panels are wrapped as `CSS3DObject` and placed in a single scene — DOM content is preserved (accessibility, interactivity), no shaders required.
- `OrthographicCamera` provides a flat, non-perspective view (matches the native viewport feel).
- A custom CameraControl owns all pointer input and computes the camera matrix directly: **axis-constrained pan**, **snap**, **edge resistance**, **pinch zoom**.
- Virtualization: panels outside `activeIndex ± overscan` are toggled invisible (`visible=false` + `display:none`), keeping the rendered DOM minimal.

The `direction` option no longer means "swipe direction" — it constrains which axis the **camera may pan along**:

- `horizontal`: pan X only — horizontal pager pattern
- `vertical`: pan Y only — vertical pager pattern
- `both`: X+Y free pan *(falls back to `horizontal` in 1.0; diagonal snap policy lands in a follow-up minor)*

## Installation

`three` is a peer dependency you provide in your host app. The React/Vue adapters depend on `@guksu/wvkit-core`, so `three` resolves transitively — install it once at the host level.

::: code-group
```sh [npm]
npm install @guksu/wvkit-core three
# add @guksu/wvkit-react or @guksu/wvkit-vue depending on framework
```
```sh [pnpm]
pnpm add @guksu/wvkit-core three
```
:::

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createScrollContainer } from '@guksu/wvkit-core';

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
import { useScrollContainer } from '@guksu/wvkit-react';

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
import { useScrollContainer } from '@guksu/wvkit-vue';

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
Add `touch-action: none` (or `touch-action: manipulation`) to the host container so the browser's default scroll/zoom does not race the custom gesture pipeline. Also set the page viewport meta to `user-scalable=no, maximum-scale=1.0` if you want pinch-zoom handled exclusively by `ScrollContainer`.
:::

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

`three` is **not bundled** into `@guksu/wvkit-core` — it is declared `external` and must be provided by your host app as a peer dependency.

When tree-shaken to only what `ScrollContainer` uses (core math + `CSS3DRenderer` + `OrthographicCamera`), `three` adds approximately **~150 KB gzipped** to your final bundle. `@guksu/wvkit-core` itself adds ~25 KB (~10 KB gzipped). Exact numbers depend on your bundler and other Three.js usage in the host app and will be measured per release in the published changelog.

## Limitations

- **`direction: 'both'`** currently falls back to `horizontal` — panels are laid out along the X axis, and pan is X-only. Diagonal snap policy lands in a follow-up minor release.
- **`panels` are `HTMLElement[]`, not React/Vue children.** Build the DOM nodes imperatively (e.g. `document.createElement`) and pass the array. A render-prop / `<PanelGroup>` higher-level API is on the roadmap.
- **Virtualization toggles `panel.style.display`** in addition to `CSS3DObject.visible`. This is a deliberate belt-and-suspenders so the panel is hidden across Three.js versions that don't consistently honour `visible=false` for CSS3D. If your panel content also sets `display`, the toggle may collide — keep `display` on a child element instead of the panel root.
- **Options are fixed at mount.** Reactive option changes (e.g. flipping `direction` at runtime in a framework adapter) require remounting the component. Use a `key` prop on the wrapper.
- **Pinch-zoom relies on `PointerEvent` and the `touch-action: none` CSS hint.** Browsers without `PointerEvent` (very old WebView versions) will silently skip pinch.
- **`setPointerCapture` is not available in every WebView build.** The implementation is guarded with `try/catch`; in environments without capture support, pointer-leaving-root during a drag may cause the gesture to be released early.
