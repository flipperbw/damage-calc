import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Tailwind v4 via the official Vite plugin: gives proper HMR for theme
  // additions (new color tokens, etc.) so editing globals.css's @theme
  // block no longer requires a manual dev-server restart.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // `@/foo` resolves to `src/foo`. Mirrors tsconfig.json's `paths`.
      // Use this everywhere instead of `../../foo` — the lint pipeline
      // (eslint-plugin-import + a precommit prettier sort) keeps it tidy.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
