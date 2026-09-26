import type { Photo } from './image-viewer';

/**
 * 레시피 예제 페이지용 사진 6장 (public/recipes/photos 의 SVG — 가로·세로·정사각 섞음).
 * 페이지가 `recipes/image-viewer/*.html` 에 있으므로 상대 경로 `../photos/` 로 가리킨다.
 */
export const PHOTOS: Photo[] = Array.from({ length: 6 }, (_, i) => ({
  src: `../photos/photo-${i + 1}.svg`,
  alt: `Sample photo ${i + 1}`,
}));
