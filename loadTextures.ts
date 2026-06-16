import { Assets, Texture, TextureSource } from 'pixi.js';

/**
 * Discover every stitched reel image inside `./screenshots_combined/`.
 *
 * We use Vite's `import.meta.glob` instead of hand-listing 40 filenames. At
 * build time Vite statically rewrites this to the hashed, fingerprinted URLs of
 * every matching file, so the list stays correct no matter how many images you
 * drop into the folder (002…040 today, or 500 tomorrow — no code change).
 *
 * `eager: true` resolves the modules immediately; `query: '?url'` +
 * `import: 'default'` gives us the final emitted URL string for each asset.
 */
export function getReelImageUrls(): string[] {
  const modules = import.meta.glob(
    './screenshots_combined/*.{jpg,jpeg,png,webp}',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>;

  // Sort by the source path so the order is deterministic (combined_002 first).
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url);
}

/**
 * Preload every reel texture through Pixi's Assets system and return them as a
 * plain array (ready to be randomly handed out to the 200 TilingSprites).
 *
 * Each source is a 720 × 8060 strip = five 720 × 1612 vertical screenshots
 * stacked on top of each other. We force `addressMode: 'repeat'` so a
 * TilingSprite can scroll through the strip forever and wrap seamlessly.
 *
 * @param onProgress optional 0..1 callback for a loading UI.
 */
export async function loadReelTextures(
  onProgress?: (progress: number) => void,
): Promise<Texture[]> {
  const urls = getReelImageUrls();

  if (urls.length === 0) {
    throw new Error(
      'No reel images found in ./screenshots_combined/. ' +
        'Expected files like combined_002.jpg … combined_040.jpg.',
    );
  }

  // Assets.load accepts an array and returns a { url: Texture } record.
  const loaded = (await Assets.load(urls, onProgress)) as Record<string, Texture>;

  // Map back to the original (sorted) URL order and configure each source for
  // seamless vertical tiling.
  return urls.map((url) => {
    const texture = loaded[url];
    const source = texture.source as TextureSource;

    // Repeat addressing is what makes the "infinite reel" scroll wrap cleanly.
    source.addressMode = 'repeat';
    // Smooth scaling — these strips get drawn at wildly different zoom levels.
    source.scaleMode = 'linear';
    source.autoGenerateMipmaps = true;
    source.update();

    return texture;
  });
}
