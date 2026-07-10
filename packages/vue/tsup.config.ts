import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scroll-container.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['vue', '@guksu/wvkit-core'],
});
