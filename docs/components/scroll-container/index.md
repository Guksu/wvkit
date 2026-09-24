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
- `both`: **deprecated.** It behaves exactly like `horizontal` and will be removed in 1.0. Use `horizontal`.

## Installation

The core has no dependencies. The React/Vue adapters depend on `@guksu/wvkit-core`. The React package also needs `react` and `react-dom` 18 or later as peer dependencies (the components render panels with `createPortal`).

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

## Components (`ScrollContainer` · `ScrollPanel`)

The React and Vue packages also export two components. You write panels as children, so you do not build `HTMLElement` arrays yourself. This is the same pattern as Swiper's `<Swiper>` + `<SwiperSlide>`.

::: code-group

```tsx [React]
import { useRef, useState } from 'react';
import {
  ScrollContainer,
  ScrollPanel,
  type ScrollContainerHandle,
} from '@guksu/wvkit-react/scroll-container';

function Tabs({ tabs }) {
  const sc = useRef<ScrollContainerHandle>(null);
  const [index, setIndex] = useState(0);

  return (
    <>
      <ScrollContainer
        ref={sc}
        direction="horizontal"
        gap={12}
        onIndexChange={setIndex}
        style={{ height: 560 }}
      >
        {tabs.map((tab) => (
          <ScrollPanel
            key={tab.id}
            label={tab.title}
            style={{ overflowY: 'auto', touchAction: 'pan-y' }}
          >
            <Feed tab={tab} />
          </ScrollPanel>
        ))}
      </ScrollContainer>
      <button onClick={() => sc.current?.scrollTo(index + 1)}>Next</button>
    </>
  );
}
```

```vue [Vue]
<script setup lang="ts">
import { ref } from 'vue';
import {
  ScrollContainer,
  ScrollPanel,
  type ScrollContainerHandle,
} from '@guksu/wvkit-vue/scroll-container';

defineProps<{ tabs: { id: string; title: string }[] }>();
const sc = ref<ScrollContainerHandle | null>(null);
const index = ref(0);
</script>
<template>
  <ScrollContainer
    ref="sc"
    direction="horizontal"
    :gap="12"
    style="height: 560px"
    @index-change="index = $event"
  >
    <ScrollPanel
      v-for="tab in tabs"
      :key="tab.id"
      :label="tab.title"
      style="overflow-y: auto; touch-action: pan-y"
    >
      <Feed :tab="tab" />
    </ScrollPanel>
  </ScrollContainer>
  <button @click="sc?.scrollTo(index + 1)">Next</button>
</template>
```

:::

- **Panel order is the order you write the panels.** Conditional panels (`{show && <ScrollPanel>}`, `v-if`) and panels wrapped in your own components keep that order. Give each panel a stable `key`. Adding or removing panels works like [`setPanels`](#changing-panels-and-options-at-runtime): the panel you were looking at stays, and the scroll position of every remaining panel is kept.
- **Every option except `panels` is a prop.** Changed props are passed to `setOptions`, so the instance is not remounted. `initialIndex` is read once, when the first panel appears.
- **Attributes on `ScrollContainer` go to the host element.** It already has `position: relative`, `overflow: hidden` and `touch-action: none`, and your `style` overrides them. Give it a height.
- **Attributes on `ScrollPanel` go to a content element inside the panel,** not to the panel element itself. The library owns the panel element (it writes `transform`, `display` and ARIA attributes on it). The content element has `height: 100%`, so put `overflow-y: auto` and `touch-action: pan-y` on `ScrollPanel` for a scrolling panel.
- **`label`** becomes the panel element's `aria-label`. Without it, `a11y` gives each panel `"n / N"`.
- **Imperative control goes through the `ref`**: `scrollTo`, `zoomTo`, `getActiveIndex`, `getZoom` (see [Component props and handle](#component-props-and-handle)). There is no controlled `activeIndex` prop. Keep your own state with `onIndexChange` (React) or `@index-change` (Vue), and call `scrollTo` to move.
- **With no panels, there is no instance.** The first panel creates it, and removing the last panel destroys it. Until then `scrollTo` and `zoomTo` do nothing.
- **Server-side rendering**: the server renders the host and one hidden marker per panel. Panel content is rendered in the browser after mount, because it is drawn into panel elements that only exist there. Content inside panels is not part of the server HTML.
- **React needs `react-dom`** (panel content is rendered with `createPortal`). It is a peer dependency of `@guksu/wvkit-react`. Context and events still work through the portal, as with any React portal. Vue uses `Teleport`, so `provide` / `inject` also works.
- **Vertical pager**: with `direction="vertical"` and `panelHeight`, the panel element gets that height. Without `panelHeight`, each panel is as tall as the host. Panels of a vertical pager must not scroll vertically ([not supported](#not-supported-a-vertical-pager-with-vertically-scrolling-panels)).

Use the hooks (`useScrollContainer`) when you already have DOM elements, for example panels built by another library. Use the components when panels are React or Vue content.

## Scrollable panels (feeds, lists, long content)

A horizontal pager whose panels scroll vertically on their own needs one extra rule: **every scrollable panel must declare `touch-action: pan-y`** (the host container keeps `touch-action: none`).

```js
const panel = document.createElement('div');
panel.style.overflowY = 'auto'; // the panel scrolls its own content
panel.style.touchAction = 'pan-y'; // vertical pans stay native, horizontal pans reach ScrollContainer
```

Why: the browser decides what a touch does by reading `touch-action` from the touched element up to the nearest *scrollable* ancestor — which is the panel itself, so the host's `touch-action: none` is never consulted. With the default `auto` (or `manipulation`) on the panel, the browser also claims horizontal pans, fires `pointercancel`, and the pager never switches. With `pan-y`, vertical touches scroll the panel natively (momentum included), horizontal touches are delivered to the pager, and diagonal touches resolve by their dominant axis, like a native pager.

- `direction: 'vertical'` does not support panels that scroll vertically. See [Not supported: a vertical pager with vertically scrolling panels](#not-supported-a-vertical-pager-with-vertically-scrolling-panels).
- Add `loading="lazy"` to images inside panels. Panels outside the `overscan` window are detached from the document, so their lazy images are not fetched until the panel becomes visible.
- Desktop: a mouse drag that starts on an `<img>` begins native drag-and-drop and cancels the gesture. Set `draggable="false"` on images inside panels.

### Not supported: a vertical pager with vertically scrolling panels

`direction: 'vertical'` does not work with panels that scroll vertically (`overflow-y: auto`). The pager and the panel both want the same vertical swipe. Measured in headless Chromium, with 3,000 px tall panels on a 640 px vertical pager:

| Input | What happens |
| --- | --- |
| Touch swipe | The panel scrolls. The pager never changes panels, even when the panel is scrolled to its end. The browser keeps the touch (`pointercancel`), and the pager also ignores touches on a `pan-y` panel. |
| Wheel or trackpad | The panel scrolls. Once the panel is at its end, the wheel changes panels. The rest of that wheel gesture can then scroll the new panel. |
| Mouse drag | The pager changes panels. The panel does not scroll. |
| Keyboard (`ArrowDown`) | The pager changes panels. |

So on a phone, users cannot swipe to the next panel. Use one of these instead:

- A **horizontal** pager with scrolling panels, as described above.
- A vertical pager with **panels that do not scroll**: fixed-height cards, full-screen images or videos.
- For a vertical feed where each page also scrolls, the browser's own **CSS scroll snap** (`scroll-snap-type: y mandatory` on the outer scroller). When an inner scroller reaches its end, the browser passes the scroll to the outer one ("scroll chaining", see [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) on MDN). Whether this happens within the same swipe depends on the browser.

Other pagers have the same limit. Android ViewPager2 "does not natively support nested scroll views in cases where the scroll view has the same orientation" ([Android docs](https://developer.android.com/develop/ui/views/animations/vp2-migration#nested-scrollables)). Swiper's maintainer suggests nesting a second Swiper for scrollable content ([discussion](https://github.com/nolimits4web/swiper/discussions/4314)). Jetpack Compose `VerticalPager` does support it, through Compose's nested scrolling.

## Changing panels and options at runtime

`setPanels(panels)` and `setOptions(changes)` update a mounted instance without remounting it. `setOptions` takes only the options you want to change, `panels` included. Passing `undefined` for an option returns it to its default.

```js
const sc = createScrollContainer(host, { direction: 'horizontal', panels, gap: 0 });

sc.setPanels([newTab, ...panels]); // the panel you were looking at stays on screen
sc.setOptions({ gap: 12, panelWidth: 0.85 }); // relayout, same instance
sc.setOptions({ panelWidth: undefined }); // back to full-width panels
```

- **The panel you were looking at stays.** If the active panel is still in the new list, it stays on screen, even while zoomed and panned. If its index changed, `onIndexChange` fires with the new index. If it was removed, the panel now at the same index becomes active.
- **Panels that stay are never detached** from the document, so their scroll positions are kept. Removed panels are detached, and their inline styles and ARIA attributes are restored.
- **Nothing happens when nothing changed.** This covers the same values, new callbacks, and a new function that returns the same layout (an inline `panelHeight: () => 300` on every render). When something did change, a gesture or animation in progress stops, and the zoom is kept inside the new `minZoom`–`maxZoom` range (`onZoomChange` fires if it had to move).
- **Invalid values change nothing.** `setOptions` and `setPanels` throw `WebviewHeadlessError` before touching the DOM. That covers the same checks as construction, plus an empty panel list or the same element twice.
- `initialIndex` is only read at mount.

**React.** `useScrollContainer` compares the options on every render and passes only the changed keys to `setOptions`. The panel array is compared element by element, so building a new array of the same elements on each render is fine.

**Vue.** Pass a `reactive` object, a `ref` or a getter to `useScrollContainer` and changes are applied the same way. A plain object is read once at mount.

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
- One panel per gesture, decided the way Android's `ViewPager` decides (`determineTargetPage`):
  - **Quick flick.** If the finger moved more than 25 px from where it touched down and was moving faster than 0.4 px/ms (400 dp/s) when it lifted, the pager moves one panel in the direction of the flick, however short the drag was. A flick back against the drag cancels it: the pager stays. These are `ViewPager`'s `MIN_DISTANCE_FOR_FLING` (25 dp) and `MIN_FLING_VELOCITY` (400 dp/s); a CSS pixel in a WebView is the same unit as a dp.
  - **Otherwise** the drag distance decides: more than `snapThreshold` of the step to the next rest position moves one panel (a small velocity weight is added).
  - A fling never skips panels.

  Measured with real touches (Chrome DevTools Protocol, Pixel 7 emulation, 412 px host) before and after the quick-flick rule. Headless Chromium delivers one touch move every 33 ms, so the speed is the last move's distance over that interval:

  | Flick | Speed at release | Before | After |
  | --- | --- | --- | --- |
  | 20 px | one move | stays | stays (not over 25 px) |
  | 30 px | 0.45 px/ms | stays | next panel |
  | 40 px | 0.6 px/ms | stays | next panel |
  | 60 px | 0.9 px/ms | stays | next panel |
  | 40 px, slow | 0.24 px/ms | stays | stays |
  | 70 px | 0.42 px/ms | stays | next panel |

  Before this rule a flick had to travel about 130 px (a third of the screen) to page.
- `scrollTo()` / `zoomTo()` with `animated: true` use a fixed 300 ms ease-out.
- `zoomTo()` clamps the camera into the active panel's range (both axes) for the new zoom level, so zooming back to 1 lands on the panel center.
- A tap that interrupts a zoom tween does not leave the zoom at an intermediate value: the release continues to the zoom that was last committed (`zoomTo`, pinch, or double tap).

## API Reference

### Options

| Prop              | Type                                       | Default        | Description                                                                                          |
| ----------------- | ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `direction`       | `'horizontal' \| 'vertical' \| 'both'`     | _(required)_   | Camera pan axis constraint. `'both'` is deprecated: it behaves like `'horizontal'` and will be removed in 1.0. |
| `panels`          | `HTMLElement[]`                            | _(required)_   | Pre-built DOM nodes added to the scene as `CSS3DObject`s. Must be non-empty.                         |
| `initialIndex`    | `number`                                   | `0`            | Active panel index at mount. Clamped to `[0, panels.length-1]`.                                      |
| `panelHeight`     | `(index: number) => number`                | _(root height)_ | Per-panel pixel height for `vertical`. Falls back to root client height.|
| `panelWidth`      | `number \| (index: number) => number`     | _(root width)_ | Panel width for `horizontal`. `(0, 1]` is a fraction of the root width, above 1 is pixels. Written to each panel's inline `width`. See [Panel width, gap and alignment](#panel-width-gap-and-alignment-peeking). |
| `gap`             | `number ≥ 0`                               | `0`            | Pixels between neighbouring panels (both directions).                                               |
| `align`           | `'center' \| 'start'`                      | `'center'`     | Where the active panel rests: centered in the root, or with its start edge on the root's start edge. |
| `onIndexChange`   | `(index: number) => void`                  | —              | Fired when active panel changes (via `scrollTo` or pan snap).                                        |
| `overscan`        | `number`                                   | `1`            | Number of extra panels to keep mounted on each side of the panels on screen. `0` mounts only the panels on screen (just the active one with full-width panels). |
| `snapThreshold`   | `number ∈ (0, 1]`                          | `0.3`          | Drag fraction (relative to the step between two rest positions) required to snap to the next panel on a slow release. A quick flick (over 25 px, over 0.4 px/ms) pages regardless. |
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
| `setPanels(panels)`                       | `void`   | Replaces the panel list without remounting. See [Changing panels and options at runtime](#changing-panels-and-options-at-runtime). |
| `setOptions(changes)`                     | `void`   | Changes options without remounting (only the keys you pass; `undefined` restores the default). |
| `destroy()`                               | `void`   | Removes all pointer listeners, the renderer DOM, and restores `display` on hidden panels. Idempotent. |

### Framework Adapter Return Values

| Field          | Type (React)                            | Type (Vue)                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`             | `Ref<HTMLElement \| null>`              |
| `activeIndex`  | `number`                                | `Ref<number>`                           |
| `activeZoom`   | `number`                                | `Ref<number>`                           |
| `scrollTo`     | `(i, opts?) => void` (stable callback)  | `(i, opts?) => void`                    |
| `zoomTo`       | `(z, opts?) => void` (stable callback)  | `(z, opts?) => void`                    |

::: tip Option changes are applied without remounting
The React hook passes changed options to `setOptions` on every render (the panel array is compared element by element). The Vue composable does the same when you pass a `reactive` object, a `ref` or a getter; a plain object is read once at mount. Callbacks (`onIndexChange`, `onZoomChange`) always stay fresh.
:::

### Component props and handle

**`ScrollContainer`** takes every [option](#options) except `panels` as a prop, plus any `div` attribute (`className` / `class`, `style`, `data-*`, `aria-*`), which goes to the host element. In Vue, listen with `@index-change` and `@zoom-change` instead of the callback options. Changed props are applied without remounting, the same as the hooks.

**`ScrollPanel`**

| Prop             | Type     | Description                                                                                   |
| ---------------- | -------- | --------------------------------------------------------------------------------------------- |
| `label`          | `string` | `aria-label` of the panel element. Without it, `a11y` sets `"n / N"`.                          |
| other attributes | —        | Go to the content element inside the panel (`height: 100%`), not to the panel element itself. |

**Handle** — `ref` on `ScrollContainer` (`ScrollContainerHandle`)

| Method                           | Returns  | Description                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------------- |
| `scrollTo(index, { animated? })` | `void`   | Same as the instance method. Does nothing while there are no panels.        |
| `zoomTo(level, { animated? })`   | `void`   | Same as the instance method. Does nothing while there are no panels.        |
| `getActiveIndex()`               | `number` | Active panel index. `initialIndex` (or `0`) while there are no panels.      |
| `getZoom()`                      | `number` | Current zoom level. `1` while there are no panels.                          |

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
| `@guksu/wvkit-core/scroll-container` | 22.4 KB | 8.7 KB |

Before 0.5 the same component pulled in a tree-shaken subset of Three.js (259 KB minified, 60 KB gzip).

The React and Vue layers are measured by `size-limit` in CI (minified, brotli, with `@guksu/wvkit-core`, React, React DOM and Vue left out): the hook is about 0.5 KB, and the components (`ScrollContainer` + `ScrollPanel`) are about 1.2–1.3 KB. Importing only the hook does not bundle the components.

## Limitations

- **`direction: 'both'` is deprecated.** It behaves exactly like `horizontal` (panels in a row along the X axis, paging on X only) and will be removed in 1.0. There is no two-axis pager; Swiper (`direction`), Embla (`axis`) and Android ViewPager2 (`orientation`) also page along one axis.
- **The core and the hooks take `panels` as `HTMLElement[]`.** Build the DOM nodes yourself and pass the array, or use the [components](#components-scrollcontainer-·-scrollpanel) to write panels as React/Vue children.
- **Components do not render panel content on the server.** Panel content appears after mount in the browser. There is no controlled `activeIndex` prop; use `onIndexChange` and the `ref` handle.
- **Virtualization toggles `panel.style.display`** on the panel root (and sets `position`, `transform`, `user-select` and `draggable` on it). If your panel content also sets those on the root, they will collide — keep your own styles on a child element instead of the panel root.
- **Changing an option or the panel list stops a gesture in progress.** `setOptions` / `setPanels` (and the adapters that call them) cancel the current drag, pinch or snap animation when something actually changed. Change options between gestures, not on every touch move.
- **Pinch-zoom and double-tap rely on `PointerEvent` and the `touch-action: none` CSS hint.** Browsers without `PointerEvent` (very old WebView versions) will silently skip both.
- **`setPointerCapture` is not available in every WebView build.** The implementation is guarded with `try/catch`; in environments without capture support, pointer-leaving-root during a drag may cause the gesture to be released early.
- **`position: fixed` inside a panel does not stick to the viewport.** Panels are CSS-transformed, so `fixed` descendants resolve against the panel and scroll with it. Render fixed overlays outside the host container.
- **Mouse drag over an `<img>` starts native drag-and-drop** (desktop), which cancels the gesture — set `draggable="false"` on images inside panels.
- **A vertical pager with vertically scrolling panels is not supported.** On touch devices it cannot change panels at all, not even at the end of the panel's scroll. See [Not supported: a vertical pager with vertically scrolling panels](#not-supported-a-vertical-pager-with-vertically-scrolling-panels).
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
