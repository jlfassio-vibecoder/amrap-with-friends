/**
 * The image a link preview shows: the same card the athlete was looking at
 * when they pressed share.
 *
 * This was landscape for a while, on the reasoning that a crawler crops
 * og:image to roughly 1.91:1 and a 9:16 card would arrive as a band out of its
 * middle. That reasoning was about the crawler and not about the athlete. What
 * they compose in the panel is a portrait card — their photo with their face
 * in it, the splits, the squad board — and a link that unfurls as something
 * else is not the thing they chose to share. Cropping is the platform's
 * decision to make on a whole card, not ours to pre-empt by sending a
 * different one.
 *
 * So the preview gets the story render, uncropped, and og:image:width/height
 * declare it as portrait so a platform that can lay one out does.
 */
import type { ShareLayout } from '@/lib/share/types';

/** The layout rendered for the link preview — the same one the panel previews. */
export const OG_LAYOUT: ShareLayout = 'story';

/**
 * WebP, not PNG.
 *
 * A card is flat colour and PNG suits it — until a photo is behind the type,
 * and then PNG is storing a photograph losslessly. The one measured was 1.3 MB
 * against a 400 KB bucket limit, so publishing a photo could not work at all:
 * the upload was refused and the link quietly kept the site logo. WebP puts the
 * same card in a fraction of that, and the bucket already accepts it.
 */
export const OG_IMAGE_TYPE = 'image/webp';

/**
 * Quality ladder, tried in order until one fits.
 *
 * A photo card at 0.9 is usually already small enough; a busy photo may not be.
 * Stepping down beats a single conservative number that would soften every
 * card for the sake of the worst one.
 */
export const OG_QUALITY_STEPS = [0.9, 0.75, 0.6];

/** Matches the bucket's own limit, so an oversized file fails here with a reason rather than at the API. */
export const MAX_OG_IMAGE_BYTES = 400 * 1024;

export function fitsOgLimit(size: number): boolean {
  return size > 0 && size <= MAX_OG_IMAGE_BYTES;
}

/**
 * The extension the storage policy expects for a blob's type. The policy
 * accepts png and webp and nothing else, so an unknown type is not silently
 * given one of them — it is refused before it reaches the API.
 */
export function extensionForType(type: string): 'png' | 'webp' | null {
  const normalised = type.toLowerCase().split(';')[0]?.trim();
  if (normalised === 'image/webp') {
    return 'webp';
  }
  if (normalised === 'image/png') {
    return 'png';
  }
  return null;
}
