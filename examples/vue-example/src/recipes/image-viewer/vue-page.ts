import { createApp, h } from 'vue';
// CSS 는 React 예제의 레시피 파일 하나를 같이 쓴다 (문서도 이 한 파일을 보여 준다)
import '../../../../react-example/src/recipes/image-viewer/image-viewer.css';
import ImageViewer from './ImageViewer.vue';

// 레시피(ImageViewer.vue)를 그대로 띄우는 예제 페이지 — e2e(recipe.image-viewer.spec.ts)가 이 페이지를 연다.
// 사진은 public/recipes/photos (React 예제와 같은 폴더를 publicDir 로 쓴다).
const photos = Array.from({ length: 6 }, (_, i) => ({
  src: `../photos/photo-${i + 1}.svg`,
  alt: `Sample photo ${i + 1}`,
}));

createApp({ render: () => h(ImageViewer, { photos }) }).mount('#app');
