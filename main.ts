import { Application, Container, TilingSprite } from 'pixi.js';
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

/** Vertical feed scroll speed at the opening close-up, in screenshots-per-second. */
const SCROLL_SPEED = 0.4;

/**
 * The feed accelerates as the camera pulls back: at full zoom-out the scroll
 * runs this many times faster than the slow opening speed. Tied to the zoom
 * progress, so the feed speeds up exactly as the loop is revealed.
 */
const SCROLL_SPEED_GAIN = 3;

/**
 * Opening overscan. 1.0 = a single reel exactly COVERS the screen (edge-to-edge,
 * cropping the slightly-longer axis, just like a full-screen TikTok). >1 adds a
 * little overscan so no black sliver ever shows at the start.
 */
const OPENING_FILL = 1.03;

/** Fraction of the viewport the finished logo should occupy. */
const FIT_FRACTION_PORTRAIT = 0.9; // 90% of width on phones
const FIT_FRACTION_LANDSCAPE = 0.6; // 60% of width on desktop

/**
 * Horizontal re-centre, reached only at full pull-back. The camera pivots on
 * the focus reel (the loop's bottom-right), so pinning it to screen-centre
 * leaves the figure-8 hanging to the left. This blends the world point that
 * lands on screen-centre from the focus reel (0) toward the loop's bounding-box
 * centre (1). The shift is back-loaded into the zoom, so the opening close-up
 * stays locked on the reel and the loop only slides to centre as it pulls back.
 */
const RECENTER_X = 1.0;

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
   *  3. Build the ribbon: ONE shared feed texture, cumulative phase
   * ---------------------------------------------------------------- */

  // Every segment samples ONE shared strip texture (720×8060 = 5 stacked reels).
  // Sharing a single texture is what makes the chain seamless: the 50 cells form
  // one continuous coordinate system, and the texture's 5-reel period divides
  // SEGMENT_COUNT (50), so the loop closes on itself with no break anywhere.
  const feedTexture = textures[0];
  const feedPeriod = SCREENSHOTS_PER_STRIP; // 5 reels per wrap

  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  // Every segment shares ONE texture and a CUMULATIVE offset (i·segLen), so the
  // 50 cells form one continuous coordinate system. Content flows seamlessly
  // across every joint; the texture repeats every `feedPeriod` reels and, because
  // feedPeriod divides SEGMENT_COUNT, the loop closes with no break anywhere.
  const segments: { sprite: TilingSprite; phaseY: number }[] = [];
  const texturePeriod = segLen * feedPeriod; // local-px length of one wrap

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const point = points[i];

    const sprite = new TilingSprite({
      texture: feedTexture,
      width: REEL_W * SEAM_OVERLAP,
      height: segLen * SEAM_OVERLAP,
    });

    // Anchor at the centre so position + rotation pivot about the segment middle.
    sprite.anchor.set(0.5);

    // STATIC position on the logo — the segment never moves; only the texture
    // offset scrolls. Raw SVG coords; the camera handles all scaling/centring.
    sprite.position.set(point.x, point.y);

    // Rotate so the feed's scroll axis (local Y) runs ALONG the curve tangent,
    // i.e. the ribbon flows around the loop.
    sprite.rotation = point.angle - Math.PI / 2;

    // Undistorted mapping: one 720×1612 reel fills one REEL_W×segLen cell.
    sprite.tileScale.set(REEL_W / SCREENSHOT_W, segLen / SCREENSHOT_H);

    // Cumulative phase: segment i sits `i` reels further along the shared strip
    // than segment 0. Neighbours are therefore exactly one reel apart and the
    // content is continuous across joints. A single shared `scroll` (below) then
    // slides the entire strip along the path as one rigid body.
    const phaseY = -i * segLen;
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

  // World-space x that should sit on screen-centre once fully pulled back.
  // RECENTER_X blends from the focus reel (no shift) to the loop's true centre.
  const finalCenterX = focus.x + RECENTER_X * (bounds.centerX - focus.x);

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
    // Horizontal reach is measured from the CENTRED point (finalCenterX), since
    // that's what ends up on screen-centre; vertical still reaches from the
    // focus reel (we only re-centre horizontally).
    const reachX = Math.max(finalCenterX - bounds.minX, bounds.maxX - finalCenterX) + REEL_W / 2;
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

  // Publish the loop's bottom edge (screen px, at the fitted view) to CSS so the
  // hero overlay can centre itself between the loop and the bottom of the
  // viewport. The lowest visible point sits ~half a ribbon-thickness below the
  // bounding box; map that world-y through the fitted camera (vertical pivot =
  // focus.y, vertical position = vh/2, scale = targetScale). app.screen is in
  // CSS px (autoDensity), so this lines up 1:1 with the CSS layout.
  function publishLoopBottom() {
    const { height: vh } = app.screen;
    const loopBottomWorldY = bounds.maxY + REEL_W / 2;
    const loopBottomY = vh / 2 + (loopBottomWorldY - focus.y) * layout.targetScale;
    document.documentElement.style.setProperty('--loop-bottom', `${loopBottomY}px`);
  }
  publishLoopBottom();

  // `camera.scale` is the single source of truth for zoom. GSAP animates it; the
  // ticker reads it every frame, so the zoom is fully decoupled from the scroll
  // (the feed never pauses) and resize can re-fit without fighting GSAP.
  const camera = { scale: layout.startScale };
  let zoomComplete = false;

  // Normalised pull-back progress for a given scale: 0 at the opening close-up,
  // 1 at the fitted view. Shared by the camera re-centre and the feed speed so
  // both ramp on exactly the same curve.
  const zoomProgress = (scale: number): number => {
    const range = layout.startScale - layout.targetScale;
    if (range <= 0) return 1;
    return Math.min(Math.max((layout.startScale - scale) / range, 0), 1);
  };

  function applyCamera() {
    const { width: vw, height: vh } = app.screen;
    const S = zoomComplete ? layout.targetScale : camera.scale;
    if (zoomComplete) camera.scale = S;

    worldContainer.scale.set(S);

    // Horizontal re-centre, back-loaded into the pull-back. `t` runs 0 → 1 as
    // the scale travels from the opening close-up to the fitted view; squaring
    // it keeps the shift ~0 through the close-up (so the camera stays locked on
    // the reel — no early lurch) and slides the loop to centre only as it pulls
    // back. The FINAL pixel shift uses the constant targetScale, NOT the live S,
    // so the huge opening scale can't amplify a tiny ramp into a big jump.
    // Vertical centring is untouched — pure horizontal nudge, no blank corners.
    const ramp = zoomProgress(S) ** 2;
    const offsetX = ramp * (focus.x - finalCenterX) * layout.targetScale;

    worldContainer.position.set(vw / 2 + offsetX, vh / 2);
  }

  // Custom resize handler: re-fit and re-centre. (Pixi's resizeTo handles the
  // canvas backing store; this handles our virtual camera.)
  window.addEventListener('resize', () => {
    layout = computeLayout();
    if (!zoomComplete) camera.scale = Math.min(camera.scale, layout.startScale);
    applyCamera();
    publishLoopBottom();
  });

  /* ---------------------------------------------------------------- *
   *  5. The render ticker — runs forever, independent of the zoom
   * ---------------------------------------------------------------- */
  let scroll = 0; // shared feed offset (local px); advances the whole ribbon
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    // Feed speed is tied to the pull-back: slow at the opening close-up and
    // SCROLL_SPEED_GAIN× faster once fully zoomed out. Same progress curve as
    // the camera, so the feed accelerates exactly as the loop is revealed.
    const speed = SCROLL_SPEED * (1 + (SCROLL_SPEED_GAIN - 1) * zoomProgress(camera.scale));
    // Advance the single shared scroll value, wrapping every texture period so
    // the floats never grow unbounded (and the wrap is invisible because the
    // texture repeats exactly there). ONE value drives ALL segments → the entire
    // strip translates along the path as a rigid body. (segLen = one reel in
    // local px, so speed is in reels/sec.)
    scroll = (scroll + speed * segLen * dt) % texturePeriod;
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

  // Camera: the cinematic pull-back. (The feed speed follows this zoom via
  // zoomProgress() in the ticker, so there's no separate scroll tween.)
  gsap.to(camera, {
    scale: layout.targetScale,
    duration: 9, // 8–10s slow, hypnotic reveal
    ease: 'power2.inOut',
    delay: 1.2, // let the viewer "settle" into the feed before pulling back
    onComplete: () => {
      zoomComplete = true; // hand scale ownership to the resize-aware ticker
      // Reveal the tagline + install CTA only now — the opening close-up,
      // camera zoom, and figure-8 reveal have all finished, so the overlay
      // never competes with them.
      const hero = document.getElementById('hero');
      if (hero) {
        hero.classList.add('revealed');
        hero.setAttribute('aria-hidden', 'false');
      }
    },
  });
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('loader');
  if (el) el.textContent = 'Failed to load — check the console.';
});
