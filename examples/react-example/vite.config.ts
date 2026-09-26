import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/wvkit/',
  build: {
    rollupOptions: {
      // 데모(index.html) + 문서 레시피 예제 페이지. e2e 가 레시피 코드를 이 페이지로 확인한다.
      // 경로는 이 패키지 폴더 기준 (pnpm --filter 로 빌드하면 작업 폴더가 여기다).
      input: {
        main: 'index.html',
        'recipe-image-viewer-vanilla': 'recipes/image-viewer/vanilla.html',
        'recipe-image-viewer-react': 'recipes/image-viewer/react.html',
      },
    },
  },
});
