import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Search-intent guides and competitor alternative pages. Each lives in its
// own directory as index.html so it is served at a clean /<slug>/ URL.
const guidePages = [
  'guides',
  'block-instagram-on-android',
  'block-instagram-reels',
  'block-youtube-shorts',
  'block-websites-on-android',
  'screen-time-app-without-ads',
  'open-source-app-blocker',
  'grayscale-apps-android',
  'batch-notifications-android',
  'stop-doomscrolling',
  'app-blocker-for-studying',
  'app-blocker-for-adhd',
  'alternatives',
  'alternatives/stay-focused',
  'alternatives/lock-me-out',
  'alternatives/appblock',
  'alternatives/screenzen',
  'alternatives/digital-wellbeing',
  'alternatives/one-sec',
  'alternatives/opal',
  'alternatives/freedom',
  'alternatives/blocksite',
  'alternatives/forest',
  'alternatives/stayfree',
  'alternatives/actiondash',
  'alternatives/regain',
  'alternatives/yourhour',
  'alternatives/social-fever',
  'alternatives/blockerx',
  'alternatives/flipd',
  'alternatives/unpluq',
  'alternatives/brick',
  'alternatives/clearspace',
  'alternatives/minimalist-phone',
  'alternatives/detoxdroid',
  // Feature landing pages, one per searched feature.
  'qr-code-app-blocker',
  'nfc-app-blocker',
  'math-unlock-app-blocker',
  'urge-surfing-app',
  'hide-youtube-recommendations',
  'hide-instagram-feed',
  'prevent-app-blocker-uninstall',
  'block-all-apps-except',
  'screen-time-tracker-android',
  'reels-counter',
  'mindful-reminder-when-opening-apps',
  'break-reminder-app-android',
  'pomodoro-app-blocker',
  'auto-do-not-disturb-schedule',
  'location-based-app-blocker',
  'website-blocker-extension',
  'app-blocker-api',
  // Screen addiction topic cluster: a hub plus one page per question.
  'screen-addiction',
  'screen-addiction/what-is-screen-addiction',
  'screen-addiction/signs-of-phone-addiction',
  'screen-addiction/phone-addiction-test',
  'screen-addiction/causes-of-phone-addiction',
  'screen-addiction/dopamine-and-phone-addiction',
  'screen-addiction/how-to-break-phone-addiction',
  'screen-addiction/screen-addiction-in-teens',
  'screen-addiction/screen-addiction-in-children',
  'screen-addiction/phone-addiction-in-adults',
  'screen-addiction/social-media-addiction',
  'screen-addiction/instagram-addiction',
  'screen-addiction/tiktok-addiction',
  'screen-addiction/youtube-addiction',
  'screen-addiction/short-form-video-addiction',
  'screen-addiction/brain-rot',
  'screen-addiction/nomophobia',
  'screen-addiction/phantom-vibration-syndrome',
  'screen-addiction/phone-addiction-and-sleep',
  'screen-addiction/phone-addiction-and-anxiety',
  'screen-addiction/phone-addiction-and-depression',
  'screen-addiction/screen-time-and-attention-span',
  'screen-addiction/phubbing',
  'screen-addiction/phone-addiction-and-relationships',
  'screen-addiction/digital-detox',
  'screen-addiction/dopamine-detox',
  'screen-addiction/how-much-screen-time-is-too-much',
  'screen-addiction/healthy-screen-time-for-adults',
  'screen-addiction/screen-addiction-and-adhd',
  'screen-addiction/phone-addiction-at-work',
  'screen-addiction/phone-addiction-in-students',
  'screen-addiction/stop-using-phone-in-bed',
  'screen-addiction/stop-checking-phone-in-the-morning',
  'screen-addiction/compulsive-phone-checking',
  'screen-addiction/notification-addiction',
  'screen-addiction/why-apps-are-addictive',
  'screen-addiction/variable-rewards-and-phones',
  'screen-addiction/mobile-game-addiction',
  'screen-addiction/binge-watching-addiction',
  'screen-addiction/reddit-addiction',
  'screen-addiction/news-addiction',
  'screen-addiction/phone-addiction-withdrawal',
  'screen-addiction/phone-addiction-relapse',
  'screen-addiction/phone-habit-loop',
  'screen-addiction/things-to-do-instead-of-scrolling',
  'screen-addiction/dumbphone-vs-app-blocker',
  'screen-addiction/how-to-reduce-screen-time',
  'screen-addiction/screen-time-goals',
  'screen-addiction/help-someone-with-phone-addiction',
  'screen-addiction/parents-phone-addiction',
  'screen-addiction/digital-eye-strain',
];

const guideInputs = Object.fromEntries(
  guidePages.map((slug) => [slug.replace(/\//g, '-'), resolve(__dirname, slug, 'index.html')]),
);

// The project root is this directory.
export default defineConfig({
  // robots.txt and sitemap.xml are hand-maintained in public/ - they cover
  // pages that live outside this build (e.g. /docs/*, served from a separate
  // repo cascaded onto this custom domain). vite-plugin-sitemap used to run
  // here, but it auto-generates both files from scratch and overwrites these
  // on every build, silently dropping the AI-crawler rules and the /docs/
  // sitemap entry.
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
        download: resolve(__dirname, 'download.html'),
        features: resolve(__dirname, 'features.html'),
        comparison: resolve(__dirname, 'comparison.html'),
        donate: resolve(__dirname, 'donate.html'),
        upi: resolve(__dirname, 'upi.html'),
        deleteAccount: resolve(__dirname, 'delete-account.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        ...guideInputs,
      },
    },
  },
});
