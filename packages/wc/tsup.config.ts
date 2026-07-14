import { defineConfig } from 'tsup';

export default defineConfig({
  // `index` is the pure exports entry; `auto` is the opt-in side-effect entry
  // that registers the custom element (imported as `@handwriting/wc/auto`).
  entry: ['src/index.ts', 'src/auto.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  external: ['@handwriting/core'],
  tsconfig: './tsconfig.json',
});
