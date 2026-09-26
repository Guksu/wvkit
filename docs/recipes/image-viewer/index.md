# Image viewer

A full-screen photo viewer built with [`ScrollContainer`](/components/scroll-container/): swipe between photos, pinch or double-tap to zoom, and a `2 / 6` counter.

Try it on a phone: [Vanilla JS](https://guksu.github.io/wvkit/recipes/image-viewer/vanilla.html) · [React](https://guksu.github.io/wvkit/recipes/image-viewer/react.html) · [Vue](https://guksu.github.io/wvkit/vue/recipes/image-viewer/vue.html)

## What it does

- One photo per panel, scaled down to fit the screen.
- Pinch to zoom up to 4×. A double tap switches between 1× and 2.5×.
- While zoomed, drag past the edge of the photo to go to the next one. The next photo starts at 1×.
- Only the photo on screen and one photo on each side are loaded. Swiping to photo 2 loads photo 3.

## Code

The code below is the source of the example pages above. The e2e tests open those pages and check each point in [What it does](#what-it-does).

::: code-group

<<< @/../examples/react-example/src/recipes/image-viewer/image-viewer.ts [Vanilla JS]

<<< @/../examples/react-example/src/recipes/image-viewer/ImageViewer.tsx [React]

<<< @/../examples/vue-example/src/recipes/image-viewer/ImageViewer.vue [Vue]

:::

The CSS is the same for all three:

<<< @/../examples/react-example/src/recipes/image-viewer/image-viewer.css

Use it like this:

```ts
// Vanilla JS: fills the element, returns a function that removes the viewer
const close = createImageViewer(document.getElementById('viewer'), photos, 0);
```

```tsx
// React and Vue: render it where the viewer should appear
<ImageViewer photos={photos} startIndex={0} />
```

Set the page viewport to `user-scalable=no, maximum-scale=1.0`, so the browser's own page zoom does not compete with the pinch (see [Basic Usage](/components/scroll-container/#basic-usage)).

## Why each part is there

### Reset zoom when the photo changes

Zoom belongs to the whole pager, not to one photo: `ScrollContainer` has one camera for all panels. Without the reset, a photo you page to while zoomed shows up at 2.5×, at its near edge.

`onIndexChange` calls `zoomTo(1)`. It lands on the new photo even when it runs during the snap animation, while the camera is still closer to the old photo. `@guksu/wvkit-core` 0.6.0 and earlier settle back on the old photo in that case.

The `getZoom() > 1` check skips the call on a normal swipe. `zoomTo` animates over a fixed 300 ms, so calling it at 1× would replace the swipe's own snap, which follows the finger's speed.

### Load each photo just before it is needed

The render window is the photo on screen plus `overscan` photos on each side. The viewer loads a photo when its panel enters that window.

- **Vanilla JS**: the `<img>` elements are created without `src`. An `<img>` starts loading as soon as it has a `src`, even when it is not in the document ([HTML spec: updating the image data](https://html.spec.whatwg.org/multipage/images.html#updating-the-image-data)). `onPanelVisibilityChange` sets `src` the first time the panel enters the window.
- **React and Vue**: `lazy` mounts each panel's content the first time the panel enters the window. The `<img>` is created then, and loads at once. Panels you never get close to never mount.

`loading="lazy"` alone did not load the next photo early at every size. In our test with Playwright's Chromium, a `loading="lazy"` image in the next panel was requested right after the page loaded when the viewer was 400 px or 800 px wide, but not when it was 1280 px wide. Setting `src` yourself does not depend on the browser's lazy-loading distance.

### Give the panel a width

Without the `panelWidth` option, `ScrollContainer` leaves the panel width to your CSS. A panel with no width shrinks to its photo, and a photo that has not loaded yet has no size (0 px wide in our test). `.image-viewer-photo` sets `width: 100%`.

### Small things

- `draggable = false` on the images: on desktop, a mouse drag that starts on an image would start native drag-and-drop and cancel the swipe.
- `-webkit-touch-callout: none`: on iOS, a long press on an image opens a "Save Image" menu.
- `aria-label="Photos"` on the pager: the library gives the pager `aria-roledescription="carousel"` but does not make up a name. Each photo is already labelled `n / N`, so the visible counter is `aria-hidden`.

## Paging while zoomed

How far you drag decides whether the photo changes. At 2.5×, the view moves 1/2.5 as far as your finger. Starting from the center of a photo:

1. The view moves 0.3 × screen width until the photo's right edge reaches the right edge of the screen.
2. From there, it moves another 0.4 × screen width + `gap` until the next photo's left edge reaches the left edge of the screen.

Drag through more than 30% of step 2 (`snapThreshold`) to go to the next photo. A shorter drag springs back to the edge. A flick never changes the photo on its own. See [Pinch zoom and panning while zoomed](/components/scroll-container/#pinch-zoom-and-panning-while-zoomed).

## Limitations

- **Zoom is shared by all photos.** You cannot come back to a photo and find it still zoomed.
- **No open and close animation.** The recipe does not animate from a thumbnail to full screen, and it has no swipe-down-to-close.
- **Zoom scales the displayed image.** To stay sharp at 4×, the source image must be about 4 times as wide as the photo appears at 1× (times the device pixel ratio).
- **Tested in browsers, not on devices.** The e2e tests run in Chromium, WebKit, and Playwright's iPhone and Android emulation. They were not run on a real iOS or Android device.

## Other libraries

If you need more than this recipe, a dedicated gallery library may fit better:

- [PhotoSwipe](https://photoswipe.com/) is a "JavaScript image gallery and lightbox". It can run the opening and closing transition from a thumbnail, and it loads larger images through `srcset` as you zoom.
- [Swiper](https://swiperjs.com/swiper-api#zoom) has a Zoom module. Each zoomable image is wrapped in a `swiper-zoom-container` element, and a double tap zooms that slide.

Choose this recipe when the viewer should share code and gesture behavior with the other `ScrollContainer` pagers in your app.
