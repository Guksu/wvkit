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

## Carousels inside panels (Swiper, Embla, native scrollers)

A panel of a horizontal pager often holds its own horizontal content, such as a hero banner carousel or a chip row. There are two kinds.

- **Native horizontal scrollers** (`overflow-x: auto`, often with `scroll-snap`) work as they are. Give them `touch-action: pan-x pan-y`: the browser then owns horizontal touches on them, and the pager does not move. The chip row in the demo is built this way.
- **JavaScript carousels** (Swiper, Embla and similar) need `noDragSelector`. They move their slides with pointer events too, so without it one swipe moves both the carousel and the pager. For example, Swiper 14 sets `touch-action: pan-y` on a horizontal carousel (`swiper.css`), so the browser leaves horizontal touches to scripts. It also listens for `pointermove` on `document`, which runs after the host's listener.

```js
createScrollContainer(host, {
  direction: 'horizontal',
  panels,
  noDragSelector: '.swiper', // a gesture that starts inside a Swiper belongs to the Swiper
});
```

- A gesture that starts inside an element matching `noDragSelector` belongs to that element. The pager does not drag, pinch or double-tap zoom for it, and it also ignores any finger added to that gesture. A gesture that starts elsewhere keeps working, even if a second finger lands on the carousel.
- The wheel over such an element is left to it, for both paging and zoomed pan. `Ctrl` + wheel zoom still works.
- At the carousel's first or last slide, swiping further does not change panels. Android's `ViewPager` hands the swipe to the outer pager when the inner view can no longer scroll (`canScroll`). ScrollContainer does not know where a JavaScript carousel is, so it does not do this.
- Only elements inside the host count. If the selector also matches the host or one of its ancestors, the pager is not switched off.

Measured with real touches (Chrome DevTools Protocol, Pixel 7 emulation) on the demo's Swiper banner, swiping 180 px to the left:

| | Banner | Pager | Camera while swiping |
| --- | --- | --- | --- |
| `noDragSelector: '.swiper'` | slide 1 → 2 | stays | never moved |
| without the option | slide 1 → 2 | panel 0 → 1 as well | moved |

## Panel width, gap and alignment (peeking)

By default every panel is as wide as the host. On a `horizontal` pager three options change that, so the neighbouring panels show at the edges. This is the "peeking" layout of e-commerce banners and card rows.

```js
createScrollContainer(host, {
  direction: 'horizontal',
  panels,
  panelWidth: 0.85, // 85 % of the host width. A number above 1 is pixels.
  gap: 12, // pixels between panels
  align: 'center', // or 'start'
});
```

- **`panelWidth`.** A number in `(0, 1]` is a fraction of the host width. A number above 1 is pixels. A function `(index) => number` gives each panel its own width in the same units. The pager writes the width to each panel's inline `style.width` and restores the old value on `destroy()`. Without `panelWidth` the pager does not touch panel widths, as before. Fraction widths follow the host on resize; pixel widths stay fixed.
- **`gap`.** Pixels between neighbouring panels. It also works on a `vertical` pager.
- **`align: 'center'`** (default) centers the active panel, so both neighbours peek. **`align: 'start'`** puts the active panel's start edge on the host's start edge, so only the next panel peeks.
- **Paging is still one panel per gesture.** `snapThreshold` and the fling weight are measured against the distance between two rest positions (panel width + `gap`), not the host width. With `panelWidth: 0.85` and `gap: 12`, one step on a 400 px host is 352 px.
- **Virtualization counts what is on screen.** The panels that overlap the host when the active panel is at rest stay mounted, plus `overscan` panels on each side. With `panelWidth: 0.85` and `overscan: 0`, a middle panel keeps three panels mounted: the active one and two peeking neighbours.
- **Zoom.** While zoomed, the camera pans only inside the active panel. A panel narrower than the host has no room to pan until the zoom is larger than host width ÷ panel width (about 1.18 for `panelWidth: 0.85`).

## Drag start and direction lock

A pointer has to move more than `dragThreshold` (10 px by default) before the pager moves. At that moment the gesture picks a direction once, by the dominant axis (whichever of |dx| and |dy| is larger, a 45° split), and keeps it until the pointer is released. The rule is the one Android's `ViewPager` uses (`xDiff > mTouchSlop && xDiff > yDiff`).

- **Pager axis dominant** → the pager drags. The start point is pulled in by the threshold, so the content does not jump: a 30 px drag moves the pager 20 px, as in `ViewPager` (`mInitialMotionX ± mTouchSlop`).
- **Cross axis dominant, zoom ≤ 1** → the pager ignores the whole gesture, even if it later turns sideways. At zoom > 1 the pan is free in both axes instead.
- **The browser will pan it** → for touch and pen, the pager computes the element's effective `touch-action` the way the browser does: from the touched element up to its nearest scroll container. If that allows panning in the chosen direction, the pager does not move and waits for the browser's `pointercancel`. Examples are a vertical touch on a `pan-y` panel, or a horizontal touch on a chip row with `pan-x pan-y`. Mouse input is not affected by `touch-action`.
- A tap that jitters less than the threshold is still a tap: it never moves the pager, and double-tap zoom still recognizes it.
- After a pinch, the remaining finger keeps panning without a new threshold, since it is already moving.
- The pointer is captured only once a drag has started, so a mouse click that wobbles a few pixels still reaches the button under it.
- `dragThreshold: 0` restores the previous behavior: the pager follows from the first move and has no direction lock.

Measured with real touches (Chrome DevTools Protocol, Pixel 7 emulation, `pan-y` feed panels) before and after this change:

| Gesture | Sideways camera wobble before | After |
| --- | --- | --- |
| Swipe at 46° from horizontal (browser scrolls the panel) | 13.9 px | 0 px |
| Swipe at 55° | 11.5 px | 0 px |
| Swipe at 70° | 6.8 px | 0 px |
| Tap with 4 px jitter | 4 px | 0 px |
| Vertical scroll that starts 6 px sideways | 6 px | 0 px |
| Straight vertical swipe at zoom 2 (browser scrolls the panel) | 20 px vertical, on screen | 0 px |

Chromium made the same 45° split on its own: at 44° it left the touch to the page, at 46° it scrolled the panel and sent `pointercancel` after about 20 px.

## Pinch zoom and panning while zoomed

- Zooming keeps the point under the fingers fixed (anchor correction, measured from the host's top-left corner), and the camera stays where the gesture ends — it does not snap back to the panel center on release.
- While zoomed, a one-finger pan moves along the pager axis all the way to the panel's edges: the pan bounds grow by `(panelSize / 2) × (1 − 1 / zoom)` on each side.
- **Cross axis.** While zoomed, the same pan also moves along the other axis (Y for `horizontal`), bounded by the panel's cross-axis extent `(crossSize / 2) × (1 − 1 / zoom)` — so a tall product photo can be inspected top to bottom. Past that extent the pan rubber-bands and springs back on release; a cross-axis flick decelerates the same way as the pager axis. At zoom 1 the cross axis stays locked, so a diagonal drag still moves the pager only. Panels that set `touch-action: pan-y` hand vertical touches to their own native scroll, so cross-axis pan only reaches panels that do not scroll on that axis (image viewers, cards).
- Paging while zoomed: drag past the panel edge into the gap before the next panel. If the drag covers more than `snapThreshold` of that gap, the camera snaps to the next panel's near edge and `onIndexChange` fires; otherwise it returns to the edge you came from. Inertia never pages on its own: a flick released inside the panel decelerates (iOS-style, 0.998 per ms) and stops at the panel edge at most, like a native photo viewer. Paging while zoomed always needs the finger to actually cross the edge.
- When the browser takes a touch for itself (`pointercancel`, e.g. a vertical touch on a `pan-y` panel that turns into native scroll), the pan is cancelled: the camera glides back to where the gesture started instead of keeping the partial movement, so content does not move twice.
- **Zoom rubber band.** Pinching past `minZoom` or `maxZoom` keeps following the fingers with the zoom damped in scale space (`min × (raw / min)^resistance`), and springs back to the limit when the last finger lifts, like `bouncesZoom` on iOS. `onZoomChange` only ever reports values inside `[minZoom, maxZoom]`. Set `resistance: 0` for a hard stop.
- **Double-tap zoom** is opt-in: `doubleTapZoom: 2` toggles between `minZoom` and 2× on a double tap (two taps within 300 ms and 40 px, each shorter than 300 ms with less than 10 px of movement). Zooming in keeps the tapped point fixed; zooming out lands on the panel center. A double tap on a button inside a panel still clicks it twice, so leave this off when panels give double taps their own meaning.

## Desktop input and accessibility

WebView teams develop and QA in a desktop browser, so the pager also works without a touch screen. Touch devices never send these events, so they cost nothing there.

- **Wheel and trackpad** (`wheel: true`, default). One wheel gesture along the pager axis moves one panel: deltas are accumulated per gesture (events less than 120 ms apart) and the pager steps once the sum passes 40 px, then ignores the rest of that gesture so trackpad momentum does not skip several panels. A wheel whose cross-axis component is larger (a vertical scroll on a horizontal pager) is left alone, and so is a wheel over a nested scroller that can still scroll in that direction (a chip row with `overflow-x: auto`). While zoomed, the wheel pans the camera inside the panel instead of paging. `Ctrl` + wheel, which is how a trackpad pinch reaches the page, zooms around the cursor. Only consumed wheel events are `preventDefault`-ed, which also stops the macOS horizontal-swipe history navigation in Chromium. Safari still needs `overscroll-behavior-x: none` on the page for that.
- **Keyboard** (`keyboard: true`, default). When the host itself has focus: the arrow keys along the pager axis move one panel, `Home` / `End` jump to the first / last panel, and `Escape` returns to `minZoom` while zoomed. Keys are ignored while focus is inside a panel (an input, a button), so panel content keeps its own keyboard behaviour. The host gets `tabindex="0"` if it has no `tabindex`; style `:focus-visible` yourself.
- **ARIA** (`a11y: true`, default), following the WAI-ARIA APG carousel pattern: the host gets `role="group"` and `aria-roledescription="carousel"`, each panel gets `role="group"`, `aria-roledescription="slide"` and `aria-label="n / N"`, and every panel except the active one gets `aria-hidden="true"` and `inert` so off-screen panels are out of the screen-reader and Tab order. Attributes you already set are left untouched, and the accessible name is yours to provide: put `aria-label` on the host. `inert` is ignored by browsers that do not know it (WebView before Chrome 102, iOS before 15.5); `aria-hidden` still applies there.

## Snap and inertia

- Release always snaps to a panel (zoom ≤ 1) or to the projected stop, edge, or gap target (zoom > 1). The settle duration follows the finger: the ease-out curve starts at the release speed (`duration = 3 × distance / velocity`), clamped between 120 ms and a distance-proportional cap of 400 ms (800 ms for a zoomed free pan). Releasing from a standstill uses the cap; velocity pointing away from the target (rubber-band return) is ignored.
- One panel per gesture. Like native pagers, a fling never skips panels; `snapThreshold` and the velocity weight decide between staying and moving one step.
- `scrollTo()` / `zoomTo()` with `animated: true` use a fixed 300 ms ease-out.
- `zoomTo()` clamps the camera into the active panel's range (both axes) for the new zoom level, so zooming back to 1 lands on the panel center.
- A tap that interrupts a zoom tween does not leave the zoom at an intermediate value: the release continues to the zoom that was last committed (`zoomTo`, pinch, or double tap).

## API Reference

### Options

| Prop              | Type                                       | Default        | Description                                                                                          |
| ----------------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `direction`       | `'horizontal' \| 'vertical' \| 'both'`     | _(required)_   | Camera pan axis constraint. `'both'` falls back to `'horizontal'` in this release.                   |
| `panels`          | `HTMLElement[]`                            | _(required)_   | Pre-built DOM nodes added to the scene as `CSS3DObject`s. Must be non-empty.                         |
| `initialIndex`    | `number`                                   | `0`            | Active panel index at mount. Clamped to `[0, panels.length-1]`.                                      |
| `panelHeight`     | `(index: number) => number`                | _(root height)_ | Per-panel pixel height for `vertical`. Falls back to root client height.|
| `panelWidth`      | `number \| (index: number) => number`     | _(root width)_ | Panel width for `horizontal`. `(0, 1]` is a fraction of the root width, above 1 is pixels. Written to each panel's inline `width`. See [Panel width, gap and alignment](#panel-width-gap-and-alignment-peeking). |
| `gap`             | `number ≥ 0`                               | `0`            | Pixels between neighbouring panels (both directions).                                               |
| `align`           | `'center' \| 'start'`                      | `'center'`     | Where the active panel rests: centered in the root, or with its start edge on the root's start edge. |
| `onIndexChange`   | `(index: number) => void`                  | —              | Fired when active panel changes (via `scrollTo` or pan snap).                                        |
| `overscan`        | `number`                                   | `1`            | Number of extra panels to keep mounted on each side of the panels on screen. `0` mounts only the panels on screen (just the active one with full-width panels). |
| `snapThreshold`   | `number ∈ (0, 1]`                          | `0.3`          | Drag fraction (relative to panel size) required to snap to the next panel.                            |
| `dragThreshold`   | `number ≥ 0`                               | `10`           | Pixels a pointer must move before the pager moves; the drag direction is decided at that point. `0` follows from the first move with no direction lock. |
| `noDragSelector`  | `string`                                   | —              | CSS selector of elements inside panels that own their gestures (JavaScript carousels such as `'.swiper'`). See [Carousels inside panels](#carousels-inside-panels-swiper-embla-native-scrollers). |
| `resistance`      | `number ∈ [0, 1]`                          | `0.2`          | Edge rubber-band coefficient. `0` is a hard stop, `1` removes resistance.                            |
| `enablePinchZoom` | `boolean`                                  | `true`         | Whether two-pointer gestures perform pinch zoom.                                                     |
| `minZoom`         | `number > 0`                               | `1.0`          | Minimum zoom level.                                                                                  |
| `maxZoom`         | `number ≥ minZoom`                         | `3.0`          | Maximum zoom level.                                                                                  |
| `doubleTapZoom`   | `number \| false`                          | `false`        | Double-tap zoom target. A number in `(minZoom, maxZoom]` toggles between `minZoom` and that level. Independent of `enablePinchZoom`. |
| `onZoomChange`    | `(zoom: number) => void`                   | —              | Fired when zoom level changes (pinch release, double tap, `Ctrl` + wheel, `zoomTo`).                 |
| `wheel`           | `boolean`                                  | `true`         | Wheel / trackpad input: one panel per gesture, camera pan while zoomed, `Ctrl` + wheel zoom.          |
| `keyboard`        | `boolean`                                  | `true`         | Arrow keys, `Home` / `End`, `Escape` while the host has focus. Adds `tabindex="0"` to the host if it has none. |
| `a11y`            | `boolean`                                  | `true`         | Carousel ARIA roles on host and panels; inactive panels get `aria-hidden` and `inert`.               |

`resistance` also damps the zoom rubber band when a pinch goes past `minZoom` / `maxZoom`.

Invalid options (empty `panels`, `minZoom ≤ 0`, `maxZoom < minZoom`, `doubleTapZoom ∉ (minZoom, maxZoom]`, `snapThreshold ∉ (0,1]`, `dragThreshold` or `gap` negative or not finite, `panelWidth` (or a value its function returns) not a finite number above 0, `noDragSelector` not a valid CSS selector, `resistance ∉ [0,1]`) throw a `WebviewHeadlessError` at construction time.

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
| `@guksu/wvkit-core/scroll-container` | 20.3 KB | 7.9 KB |

Before 0.5 the same component pulled in a tree-shaken subset of Three.js (259 KB minified, 60 KB gzip).

## Limitations

- **`direction: 'both'`** currently falls back to `horizontal` — panels are laid out along the X axis, and pan is X-only. Diagonal snap policy lands in a follow-up minor release.
- **`panels` are `HTMLElement[]`, not React/Vue children.** Build the DOM nodes imperatively (e.g. `document.createElement`) and pass the array. A render-prop / `<PanelGroup>` higher-level API is on the roadmap.
- **Virtualization toggles `panel.style.display`** on the panel root (and sets `position`, `transform`, `user-select` and `draggable` on it). If your panel content also sets those on the root, they will collide — keep your own styles on a child element instead of the panel root.
- **Options are fixed at mount.** Reactive option changes (e.g. flipping `direction` at runtime in a framework adapter) require remounting the component. Use a `key` prop on the wrapper.
- **Pinch-zoom and double-tap rely on `PointerEvent` and the `touch-action: none` CSS hint.** Browsers without `PointerEvent` (very old WebView versions) will silently skip both.
- **`setPointerCapture` is not available in every WebView build.** The implementation is guarded with `try/catch`; in environments without capture support, pointer-leaving-root during a drag may cause the gesture to be released early.
- **`position: fixed` inside a panel does not stick to the viewport.** Panels are CSS-transformed, so `fixed` descendants resolve against the panel and scroll with it. Render fixed overlays outside the host container.
- **Mouse drag over an `<img>` starts native drag-and-drop** (desktop), which cancels the gesture — set `draggable="false"` on images inside panels.
- **Cross-axis pan while zoomed needs panels that do not scroll on that axis.** A panel with `touch-action: pan-y` gives vertical touches to its own native scroll, so on a `horizontal` pager only non-scrolling panels (image viewers, cards) pan vertically while zoomed.
- **A wheel gesture moves one panel and cannot page while zoomed.** Trackpad momentum is ignored after the first step, and a fast mouse-wheel spin counts as one gesture until it pauses for 120 ms. While zoomed, the wheel pans inside the panel; use the arrow keys or zoom out to change panels.
- **Keyboard shortcuts only work while the host has focus.** Focus inside a panel keeps its own key handling. The host's focus ring is not styled for you.
- **`inert` on inactive panels blocks pointer events too.** With `minZoom` below 1, neighbouring panels that are visible cannot be clicked until they become active. Set `a11y: false` if you need that.
- **The first `dragThreshold` pixels of a drag do not move the pager, and the direction is decided once.** A gesture that starts vertical cannot turn into paging halfway, and a curved swipe near 45° can be judged differently by the pager and by the browser, in which case neither moves. Lower `dragThreshold` for a faster start, or set `0` for the previous behavior.
- **A fling moves at most one panel.** The settle duration follows the release velocity (120–400 ms), but there is no multi-panel momentum on the pager axis, by design (native pagers behave the same).
- **Text inside panels cannot be selected.** `CSS3DObject` sets `user-select: none` (and `draggable="false"`) on every panel element. Inputs inside panels still work.
- **Panel DOM is never unmounted.** Virtualization only detaches or hides panels outside the `overscan` window; every panel stays in memory for the life of the instance. Virtualize long lists inside panels yourself.
- **Each visible scrollable panel is its own compositor layer** (browsers composite scroll containers). With `overscan: 1` three such layers are alive at once. Measured in headless Chromium, a 150-image feed panel became a 412 × 47,773 px layer. Keep `overscan` small on low-end devices.
- **Scroll position of a hidden panel survives in Chromium** (verified across a `display: none` round-trip) **but is unverified in WebKit.** Test on iOS before relying on it.
- **`scrollTo(index)` while zoomed lands on the panel center** (with `align: 'start'`, on its start edge), not on the edge you were looking at.
- **A carousel inside a panel does not hand the swipe back at its ends.** With `noDragSelector`, a swipe that starts on the carousel never changes panels, even at its first or last slide. Pinch and double-tap zoom do not start on it either.
- **Peeking neighbours are not interactive.** With `a11y: true` (default) every panel except the active one gets `inert`, so a tap on a peeking neighbour does nothing. Swipe to it, or set `a11y: false` and handle the tap yourself.
- **The first and last panels leave empty space with narrow panels.** `align: 'center'` shows a gap before the first panel and after the last one, and `align: 'start'` after the last one. There is no option yet to pin the ends to the host edges.
- **`panelWidth` only applies to `horizontal`.** A `vertical` pager uses `panelHeight` and ignores `panelWidth`.
