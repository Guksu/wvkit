import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';

export interface Photo {
  src: string;
  alt: string;
}

/** Fills `root` with a photo viewer. Returns a function that removes it. */
export function createImageViewer(root: HTMLElement, photos: Photo[], startIndex = 0): () => void {
  const pager = document.createElement('div');
  pager.className = 'image-viewer-pager';
  pager.setAttribute('aria-label', 'Photos');
  const count = document.createElement('p');
  count.className = 'image-viewer-count';
  count.setAttribute('aria-hidden', 'true'); // each slide is already labelled "n / N"
  root.classList.add('image-viewer');
  root.append(pager, count);

  // No src yet: onPanelVisibilityChange sets it when the panel is about to be seen.
  const panels = photos.map((photo) => {
    const panel = document.createElement('div');
    panel.className = 'image-viewer-photo';
    const img = document.createElement('img');
    img.alt = photo.alt;
    img.decoding = 'async';
    img.draggable = false; // desktop: dragging an image would start native drag-and-drop
    panel.append(img);
    return panel;
  });

  const showCount = (index: number) => {
    count.textContent = `${index + 1} / ${photos.length}`;
  };

  const viewer = createScrollContainer(pager, {
    direction: 'horizontal',
    panels,
    initialIndex: startIndex,
    gap: 16,
    overscan: 1, // the render window: the photo on screen and one photo on each side
    maxZoom: 4,
    doubleTapZoom: 2.5,
    onPanelVisibilityChange: (index, visible, panel) => {
      // Load a photo when its panel enters the render window, so the next one is ready before you swipe.
      const img = panel.querySelector('img');
      const photo = photos[index];
      if (visible && img && photo && !img.src) img.src = photo.src;
    },
    onIndexChange: (index) => {
      showCount(index);
      // Zoom belongs to the whole pager, not to one photo. Start every photo at fit.
      if (viewer.getZoom() > 1) viewer.zoomTo(1);
    },
  });
  showCount(viewer.getActiveIndex());

  return () => {
    viewer.destroy();
    pager.remove();
    count.remove();
    root.classList.remove('image-viewer');
  };
}
