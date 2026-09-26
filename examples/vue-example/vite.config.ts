import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  base: '/wvkit/vue/',
  // 레시피 예제 사진(recipes/photos)을 React 예제와 한 벌로 쓴다
  publicDir: '../react-example/public',
  build: {
    rollupOptions: {
      // 데모(index.html) + 문서 레시피 예제 페이지. e2e 가 레시피 코드를 이 페이지로 확인한다.
      // 경로는 이 패키지 폴더 기준 (pnpm --filter 로 빌드하면 작업 폴더가 여기다).
      input: {
        main: 'index.html',
        'recipe-image-viewer-vue': 'recipes/image-viewer/vue.html',
      },
    },
  },
});
