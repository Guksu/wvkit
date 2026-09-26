import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './image-viewer.css';
import { ImageViewer } from './ImageViewer';
import { PHOTOS } from './photos';

// 레시피(ImageViewer.tsx)를 그대로 띄우는 예제 페이지 — e2e(recipe.image-viewer.spec.ts)가 이 페이지를 연다.
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ImageViewer photos={PHOTOS} />
    </StrictMode>,
  );
}
