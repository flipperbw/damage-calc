import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @smogon/calc ships CJS that uses tslib's __createBinding for re-exports,
  // which Vite's static analysis can't follow. Pre-bundling via esbuild
  // (which understands the pattern) makes named imports resolve correctly.
  optimizeDeps: {
    include: ['@smogon/calc'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /calc[\\/]dist/],
      transformMixedEsModules: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
});
