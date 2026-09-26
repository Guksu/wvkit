import { useRef, useState } from 'react';
import {
  ScrollContainer,
  ScrollPanel,
  type ScrollContainerHandle,
} from '@guksu/wvkit-react/scroll-container';

interface Photo {
  src: string;
  alt: string;
}

export function ImageViewer({ photos, startIndex = 0 }: { photos: Photo[]; startIndex?: number }) {
  const viewer = useRef<ScrollContainerHandle>(null);
  const [index, setIndex] = useState(startIndex);

  return (
    <div className="image-viewer">
      <ScrollContainer
        ref={viewer}
        className="image-viewer-pager"
        aria-label="Photos"
        direction="horizontal"
        initialIndex={startIndex}
        gap={16}
        lazy // mount a photo when its panel enters the render window (on screen + overscan)
        overscan={1}
        maxZoom={4}
        doubleTapZoom={2.5}
        onIndexChange={(i) => {
          setIndex(i);
          // Zoom belongs to the whole pager, not to one photo. Start every photo at fit.
          if ((viewer.current?.getZoom() ?? 1) > 1) viewer.current?.zoomTo(1);
        }}
      >
        {photos.map((photo) => (
          <ScrollPanel key={photo.src} className="image-viewer-photo">
            <img src={photo.src} alt={photo.alt} decoding="async" draggable={false} />
          </ScrollPanel>
        ))}
      </ScrollContainer>
      <p className="image-viewer-count" aria-hidden="true">
        {index + 1} / {photos.length}
      </p>
    </div>
  );
}
