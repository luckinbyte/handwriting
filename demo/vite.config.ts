import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, resolve the workspace packages to their TypeScript source so edits
// hot-reload instantly. NOTE: alias order matters — more-specific paths
// (`@handwriting/wc/auto`, `@handwriting/core/styles.css`) must precede their
// prefixes (`@handwriting/wc`, `@handwriting/core`).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@handwriting/core/styles.css',
        replacement: resolve(__dirname, '../packages/core/src/index.css'),
      },
      { find: '@handwriting/core', replacement: resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@handwriting/react', replacement: resolve(__dirname, '../packages/react/src/index.ts') },
      {
        find: '@handwriting/wc/auto',
        replacement: resolve(__dirname, '../packages/wc/src/auto.ts'),
      },
      { find: '@handwriting/wc', replacement: resolve(__dirname, '../packages/wc/src/index.ts') },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        react: resolve(__dirname, 'react.html'),
        wc: resolve(__dirname, 'wc.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
