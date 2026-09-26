import './image-viewer.css';
import { createImageViewer } from './image-viewer';
import { PHOTOS } from './photos';

// 레시피(image-viewer.ts)를 그대로 띄우는 예제 페이지 — e2e(recipe.image-viewer.spec.ts)가 이 페이지를 연다.
const root = document.getElementById('viewer');
if (root) createImageViewer(root, PHOTOS);
