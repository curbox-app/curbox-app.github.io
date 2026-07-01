import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import sitemap from 'vite-plugin-sitemap';

// The project root is this directory.
export default defineConfig({
  plugins: [sitemap({ hostname: 'https://curbox.app' })],
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
        // The content-rich, crawlable landing page.
        main: resolve(__dirname, 'index.html'),
        // The cinematic WebGL canvas page, served at /install-android/.
        installAndroid: resolve(__dirname, 'install-android/index.html'),
        about: resolve(__dirname, 'about.html'),
        features: resolve(__dirname, 'features.html'),
        donate: resolve(__dirname, 'donate.html'),
        upi: resolve(__dirname, 'upi.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
      },
    },
  },
});
