import { Assets, Texture, TextureSource } from 'pixi.js';
import reelStripUrl from './assets/screenshots_combined/combined.webp?url';

/**
 * Preload the reel texture through Pixi's Assets system.
 *
 * The source is a 720 × 8060 strip = five vertical screenshots stacked on
 * top of each other. We force `addressMode: 'repeat'` so a TilingSprite can
 * scroll through the strip forever and wrap seamlessly.
 *
 * @param onProgress optional 0..1 callback for a loading UI.
 */
export async function loadReelTexture(
  onProgress?: (progress: number) => void,
): Promise<Texture> {
  const texture = await Assets.load(reelStripUrl, onProgress);

  const source = texture.source as TextureSource;

  // Repeat addressing is what makes the "infinite reel" scroll wrap cleanly.
  source.addressMode = 'repeat';
  // Smooth scaling — these strips get drawn at wildly different zoom levels.
  source.scaleMode = 'linear';
  source.autoGenerateMipmaps = false;
  source.update();

  return texture;
}
