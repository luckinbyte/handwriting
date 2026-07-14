import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve the workspace core package to its TypeScript source so cross-package
  // tests (react/wc) exercise current source, not a stale built dist.
  resolve: {
    alias: [
      {
        find: '@handwriting/core',
        replacement: resolve(__dirname, 'packages/core/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'happy-dom',
    passWithNoTests: true,
    include: ['packages/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.tsx', 'demo/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/index.ts'],
    },
  },
});
