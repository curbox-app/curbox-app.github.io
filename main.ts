import { Application, Container, TilingSprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';

import { loadReelTextures } from './loadTextures';
// Vite raw import — the SVG arrives as a plain string we can parse ourselves.
import svgContent from './infinity.svg?raw';

/* ------------------------------------------------------------------ *
 *  CONFIGURATION
 * ------------------------------------------------------------------ */

/**
 * How many segments make up the ribbon. The whole infinity loop is ONE
 * continuous TikTok feed: ~200 screenshots stacked head-to-tail and bent around
 * the figure-8. Each segment is exactly one screenshot tall, so they abut (never
 * overlap) and together read as a single feed flowing along the path.
 */
const SEGMENT_COUNT = 50;

/** Geometry of a single source screenshot inside the stitched strip. */
const SCREENSHOT_W = 720; // px — one vertical reel's width
const SCREENSHOT_H = 1612; // px — one vertical reel's height (5 of these = 8060)
const SCREENSHOTS_PER_STRIP = 5; // each combined_***.jpg stacks 5 reels (8060px)

/**
 * Tiny overlap between consecutive segments. The curve bends between segments,
 * so perfectly abutting rectangles would leave hairline wedge-gaps on the outer
 * edge. A few % overlap closes them invisibly — this is NOT the old "stacked on
 * top of each other" bug, just anti-seam insurance.
 */
const SEAM_OVERLAP = 1.04;

/** Vertical feed scroll speed, in screenshots-per-second. */
const SCROLL_SPEED = 0.4;

/**
 * Opening overscan. 1.0 = a single reel exactly COVERS the screen (edge-to-edge,
 * cropping the slightly-longer axis, just like a full-screen TikTok). >1 adds a
 * little overscan so no black sliver ever shows at the start.
 */
const OPENING_FILL = 1.03;

/** Fraction of the viewport the finished logo should occupy. */
const FIT_FRACTION_PORTRAIT = 0.9; // 90% of width on phones
const FIT_FRACTION_LANDSCAPE = 0.6; // 60% of width on desktop

/* ------------------------------------------------------------------ *
 *  TYPES
 * ------------------------------------------------------------------ */

interface SamplePoint {
  x: number;
  y: number;
  /** Tangent angle (radians) of the curve at this point. */
  angle: number;
}

interface Layout {
  /** Absolute world-space scale that fits the whole logo on screen. */
  targetScale: number;
  /** World-space scale for the opening close-up (one reel fills the screen). */
  startScale: number;
}

/* ------------------------------------------------------------------ *
 *  1. SVG → evenly-spaced points along the infinity curve
 * ------------------------------------------------------------------ */

/**
 * Parse the raw infinity SVG, walk its <path>, and sample `count` points evenly
 * by arc-length. For each point we also sample a neighbour slightly further
 * along the curve and use `atan2` to capture the tangent direction, so every
 * reel can be rotated to flow with the loop.
 */
function sampleInfinityPath(
  svg: string,
  count: number,
): { points: SamplePoint[]; totalLength: number } {
  // Parse the raw markup and pull out the first <path>'s "d" attribute.
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const sourcePath = doc.querySelector('path');
  if (!sourcePath) throw new Error('infinity.svg contains no <path>.');
  const d = sourcePath.getAttribute('d');
  if (!d) throw new Error('infinity.svg <path> has no "d" attribute.');

  // Build a live, measurable SVG path in the real DOM. getTotalLength() /
  // getPointAtLength() only work on an element attached to a rendered document,
  // so we mount a 0-size, off-screen SVG, measure, then tear it down.
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(NS, 'svg');
  svgEl.setAttribute('width', '0');
  svgEl.setAttribute('height', '0');
  svgEl.style.position = 'absolute';
  svgEl.style.visibility = 'hidden';
  svgEl.style.pointerEvents = 'none';

  const pathEl = document.createElementNS(NS, 'path');
  pathEl.setAttribute('d', d);
  svgEl.appendChild(pathEl);
  document.body.appendChild(svgEl);

  const totalLength = pathEl.getTotalLength();
  // A small look-ahead distance for the tangent (1/2000th of the loop).
  const ahead = totalLength / 2000;

  // Tangent angle of the curve at a given arc-length (radians).
  const angleAt = (dist: number): number => {
    const p = pathEl.getPointAtLength(dist % totalLength);
    const pNext = pathEl.getPointAtLength((dist + ahead) % totalLength);
    return Math.atan2(pNext.y - p.y, pNext.x - p.x);
  };

  // --- Find the BOTTOM-RIGHT spot where a reel stands perfectly vertical ----
  // The figure-8 has points (the left/right extremes of each loop) where the
  // tangent is dead vertical, i.e. angle ≈ +90° (pointing straight down, so the
  // reel is upright and right-side-up). We want specifically the bottom-right
  // one, so we score each path sample by "how vertical" (dominant) and then, as
  // a tie-breaker, "how bottom-right" (large x + large y, since y points down).
  // Starting the segment grid here means the opening reel needs ZERO world
  // rotation — which is what kills the old "swing + blank flash".
  let focusDist = 0;
  let bestScore = -Infinity;
  const scanSteps = 4000;
  for (let s = 0; s < scanSteps; s++) {
    const dist = (s / scanSteps) * totalLength;
    // Angular distance to +90° (down), wrapped to [-π, π].
    let err = angleAt(dist) - Math.PI / 2;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const p = pathEl.getPointAtLength(dist);
    // Verticality dominates (huge weight); (x + y) picks the bottom-right one.
    const score = -5000 * Math.abs(err) + (p.x + p.y);
    if (score > bestScore) {
      bestScore = score;
      focusDist = dist;
    }
  }

  // Sample `count` segments head-to-tail, STARTING at the vertical focus point,
  // so points[0] is the upright opening reel and the rest wrap around the loop.
  const points: SamplePoint[] = [];
  const step = totalLength / count;
  for (let i = 0; i < count; i++) {
    const dist = (focusDist + i * step) % totalLength;
    const p = pathEl.getPointAtLength(dist);
    points.push({ x: p.x, y: p.y, angle: angleAt(dist) });
  }

  document.body.removeChild(svgEl);
  return { points, totalLength };
}

/* ------------------------------------------------------------------ *
 *  2. Bounding box of the sampled points
 * ------------------------------------------------------------------ */

function boundsOf(points: SamplePoint[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/* ------------------------------------------------------------------ *
 *  BOOT
 * ------------------------------------------------------------------ */

async function main() {
  /* --- Pixi application: mobile-first, high-DPI, full-window --------- */
  const app = new Application();
  await app.init({
    resizeTo: window, // auto-track 100vw / 100vh
    background: '#000000',
    antialias: true,
    // Crisp rendering on high-DPI OLED screens, capped at 2 so a 3×–4× phone
    // doesn't blow up the GPU fill-rate for no visible gain.
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true, // keep the CSS size at 100vw/vh while backing store scales
    powerPreference: 'high-performance',
  });

  const appEl = document.getElementById('app')!;
  appEl.appendChild(app.canvas);

  /* --- Load every reel texture (with a progress veil) --------------- */
  const loaderEl = document.createElement('div');
  loaderEl.id = 'loader';
  loaderEl.textContent = 'Loading';
  document.body.appendChild(loaderEl);

  const textures = await loadReelTextures((p) => {
    loaderEl.textContent = `Loading ${Math.round(p * 100)}%`;
  });

  /* --- Sample the infinity curve & measure it ---------------------- */
  const { points, totalLength } = sampleInfinityPath(svgContent, SEGMENT_COUNT);
  const bounds = boundsOf(points);

  /**
   * Ribbon geometry — this is what makes it read as one continuous feed.
   *
   * The loop is sliced into SEGMENT_COUNT equal arc-length pieces. Each segment
   * shows EXACTLY ONE screenshot, so consecutive segments stack head-to-tail
   * (like a TikTok feed) all the way around the figure-8. From that single
   * constraint everything else follows:
   *   - segLen : how much path-length one screenshot occupies (the segment's
   *              height, measured ALONG the curve).
   *   - REEL_W : the ribbon's thickness, fixed by the real 720×1612 aspect so a
   *              screenshot is never stretched.
   */
  const segLen = totalLength / SEGMENT_COUNT;
  const REEL_W = segLen * (SCREENSHOT_W / SCREENSHOT_H);

  /* ---------------------------------------------------------------- *
   *  3. Build the ribbon: one screenshot per segment, head-to-tail
   * ---------------------------------------------------------------- */
  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  // Each segment carries a fixed "phase" so neighbours show CONSECUTIVE
  // screenshots. A single shared scroll value then slides the whole feed along
  // the path as one body (not 200 independent loops).
  const segments: { sprite: TilingSprite; phaseY: number }[] = [];

  // One full texture = SCREENSHOTS_PER_STRIP screenshots; in local sprite units
  // a single screenshot spans exactly `segLen`, so the texture repeats every:
  const stripPeriod = segLen * SCREENSHOTS_PER_STRIP;

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const point = points[i];

    // Lay the global feed down in order: 5 screenshots per stitched strip, so
    // segments 0-4 are strip A's reels in order, 5-9 strip B's, etc. This makes
    // the whole loop a coherent, varied feed (≈195 distinct reels).
    const stripIndex = Math.floor(i / SCREENSHOTS_PER_STRIP) % textures.length;
    const screenshotInStrip = i % SCREENSHOTS_PER_STRIP;
    const texture: Texture = textures[stripIndex];

    const sprite = new TilingSprite({
      texture,
      width: REEL_W * SEAM_OVERLAP,
      height: segLen * SEAM_OVERLAP,
    });

    // Anchor at the centre so position + rotation pivot about the segment middle.
    sprite.anchor.set(0.5);

    // STATIC position on the logo — the segment never moves; only its texture
    // scrolls. Raw SVG coords; the camera container handles all scaling/centring.
    sprite.position.set(point.x, point.y);

    // Rotate so the feed's scroll axis (local Y) runs ALONG the curve tangent,
    // i.e. the ribbon flows around the loop.
    sprite.rotation = point.angle - Math.PI / 2;

    // Undistorted mapping: one 720×1612 screenshot fills one REEL_W×segLen cell.
    sprite.tileScale.set(REEL_W / SCREENSHOT_W, segLen / SCREENSHOT_H);

    // Phase: park this segment on its assigned screenshot. Because neighbours
    // are one screenshot apart, the static frame already looks like a stacked
    // feed; scrolling then translates that feed bodily along the path.
    const phaseY = -screenshotInStrip * segLen;
    sprite.tilePosition.y = phaseY;

    worldContainer.addChild(sprite);
    segments.push({ sprite, phaseY });
  }

  /* ---------------------------------------------------------------- *
   *  4. Camera: pivot ON the focus reel — pure zoom, no pan
   * ---------------------------------------------------------------- */

  // Opening focus reel = segment 0, which the sampler placed exactly on the
  // path's bottom-right vertical-tangent point. Its rotation is ≈0, so it stands
  // perfectly upright with NO world rotation.
  const focus = points[0];

  // PIVOT ON THE FOCUS REEL and keep the container pinned to screen-centre.
  // Scaling now happens entirely AROUND the focus reel, so it stays dead-centre
  // from the opening close-up all the way out — a pure zoom, never a pan. This
  // is what removes the "camera slightly moves right" drift.
  worldContainer.pivot.set(focus.x, focus.y);

  /** Compute the opening + fitted scales for the current viewport. */
  function computeLayout(): Layout {
    const { width: vw, height: vh } = app.screen;
    const isLandscape = vw > vh;
    const fitFraction = isLandscape ? FIT_FRACTION_LANDSCAPE : FIT_FRACTION_PORTRAIT;

    // FINAL: because the focus reel stays centred, we must fit the logo AROUND
    // that off-centre point. The reach we need on each axis is the farther of
    // the two distances from the focus to the bounding-box edges (+ ribbon
    // thickness). Fitting that half-extent guarantees the whole loop is visible
    // with the focus reel at screen-centre.
    const reachX = Math.max(focus.x - bounds.minX, bounds.maxX - focus.x) + REEL_W / 2;
    const reachY = Math.max(focus.y - bounds.minY, bounds.maxY - focus.y) + REEL_W / 2;
    const targetScale = Math.min(
      (fitFraction * vw) / (2 * reachX),
      (0.92 * vh) / (2 * reachY),
    );

    // OPENING: scale so a SINGLE reel covers the whole screen (max of the two
    // axis fits = "cover"), so it reads as one full-bleed vertical TikTok.
    const startScale = Math.max(vw / REEL_W, vh / segLen) * OPENING_FILL;

    return { targetScale, startScale };
  }

  let layout = computeLayout();

  // `camera.scale` is the single source of truth for zoom. GSAP animates it; the
  // ticker reads it every frame, so the zoom is fully decoupled from the scroll
  // (the feed never pauses) and resize can re-fit without fighting GSAP.
  const camera = { scale: layout.startScale };
  let zoomComplete = false;

  function applyCamera() {
    const { width: vw, height: vh } = app.screen;
    const S = zoomComplete ? layout.targetScale : camera.scale;
    if (zoomComplete) camera.scale = S;

    // Pure zoom about the focus reel: scale changes, the pivoted focus point
    // stays pinned to screen-centre. No rotation, no pan — never a blank corner.
    worldContainer.scale.set(S);
    worldContainer.position.set(vw / 2, vh / 2);
  }

  // Custom resize handler: re-fit and re-centre. (Pixi's resizeTo handles the
  // canvas backing store; this handles our virtual camera.)
  window.addEventListener('resize', () => {
    layout = computeLayout();
    if (!zoomComplete) camera.scale = Math.min(camera.scale, layout.startScale);
    applyCamera();
  });

  /* ---------------------------------------------------------------- *
   *  5. The render ticker — runs forever, independent of the zoom
   * ---------------------------------------------------------------- */
  let scroll = 0; // shared feed offset (local px); advances the whole ribbon
  // Feed speed ramps up over time (see the GSAP tween below): it starts gently
  // and eases into full speed, so the opening reel drifts slowly before the feed
  // gets going. `screenshotsPerSec` is animated; the ticker just reads it.
  const feed = { screenshotsPerSec: SCROLL_SPEED * 0.12 };
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    // Advance the single shared scroll value, wrapping every strip period so the
    // floats never grow unbounded. ONE value drives ALL segments → the entire
    // stacked feed translates along the path as a body. (segLen = one screenshot
    // in local px, so speed is in screenshots/sec.)
    scroll = (scroll + feed.screenshotsPerSec * segLen * dt) % stripPeriod;
    for (const { sprite, phaseY } of segments) {
      sprite.tilePosition.y = phaseY - scroll;
    }
    applyCamera();
  });

  /* ---------------------------------------------------------------- *
   *  6. The cinematic pull-back
   * ---------------------------------------------------------------- */
  loaderEl.classList.add('hidden');
  setTimeout(() => loaderEl.remove(), 700);

  // Feed scroll: start slow, then ease IN up to full speed.
  gsap.to(feed, {
    screenshotsPerSec: SCROLL_SPEED,
    duration: 5,
    ease: 'power2.in', // accelerate gently from the slow opening drift
    delay: 0.3,
  });

  // Camera: the cinematic pull-back.
  gsap.to(camera, {
    scale: layout.targetScale,
    duration: 9, // 8–10s slow, hypnotic reveal
    ease: 'power2.inOut',
    delay: 1.2, // let the viewer "settle" into the feed before pulling back
    onComplete: () => {
      zoomComplete = true; // hand scale ownership to the resize-aware ticker
    },
  });
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('loader');
  if (el) el.textContent = 'Failed to load — check the console.';
});
