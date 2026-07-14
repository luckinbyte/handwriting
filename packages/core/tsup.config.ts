import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  // hanzi-writer is an optional peer, dynamically imported — never bundled.
  external: ['hanzi-writer'],
  async onSuccess() {
    mkdirSync('dist', { recursive: true });
    try {
      copyFileSync('src/index.css', 'dist/index.css');
    } catch {
      // index.css may not exist yet during early scaffolding.
    }
  },
});
