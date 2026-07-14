import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  // Peer + workspace dep are consumed by the host; never bundled.
  external: ['react', 'react-dom', '@handwriting/core'],
  tsconfig: './tsconfig.json',
});
