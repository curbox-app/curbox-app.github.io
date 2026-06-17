import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The project root is this directory.
export default defineConfig({
  base: '/',
  server: {
    host: true, // expose on the LAN so you can open it on a real phone
    port: 5173,
  },
  build: {
    // The stitched reels are large; raise the inline limit so they always
    // ship as separate, cacheable files instead of being base64-inlined.
    assetsInlineLimit: 0,
    rollupOptions: {
      // Multi-page build: the canvas landing page plus the static content
      // pages. Without this, `vite build` would emit only index.html and the
      // content pages would 404 in production.
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        features: resolve(__dirname, 'features.html'),
        donate: resolve(__dirname, 'donate.html'),
      },
    },
  },
});
