import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes the build work from any sub-path
// (GitHub Pages project sites, a folder on your own host, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Phaser is ~1 MB minified; split it so the app code stays small
    // and the browser can cache Phaser separately.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
