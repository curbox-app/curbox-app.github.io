import { defineConfig } from 'vite';

// The project root is this directory, so `./infinity.svg?raw` and
// `./screenshots_combined/*.jpg` resolve directly against it.
export default defineConfig({
  base: './',
  server: {
    host: true, // expose on the LAN so you can open it on a real phone
    port: 5173,
  },
  build: {
    // The stitched reels are large; raise the inline limit so they always
    // ship as separate, cacheable files instead of being base64-inlined.
    assetsInlineLimit: 0,
  },
});
