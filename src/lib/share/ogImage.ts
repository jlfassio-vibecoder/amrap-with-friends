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
 * The layout X gets.
 *
 * X crops og:image to roughly 1.9:1 out of the vertical middle. On a posted
 * portrait card that kept the reps line, the movement list and half the chart,
 * and cropped away the hero score, the athlete's name, the link and the
 * watermark. Landscape is 1.78:1 and survives it, and twitter:image is a
 * separate tag from og:image for exactly this reason.
 */
export const OG_WIDE_LAYOUT: ShareLayout = 'landscape';

export interface OgEncoding {
  type: string;
  quality?: number;
}

/**
 * What to try encoding the card as, in order, stopping at the first that fits.
 *
 * PNG first, because it is the format every link preview on earth can decode.
 * A card with no photo behind it is flat colour and lands around 140 KB, so
 * most cards never leave the first rung.
 *
 * WebP is the fallback rather than the default. It is small — a photo card
 * that is 1.3 MB as PNG is under 40 KB as WebP, which is the only reason
 * publishing a photo works at all against a 400 KB bucket — but it is also the
 * format a renderer is most likely not to support, and a card nobody can
 * decode is worth less than a slightly larger one everybody can.
 *
 * The quality rungs step down rather than starting conservative: softening
 * every photo card for the sake of the busiest one is a worse trade.
 */
export const OG_ENCODINGS: OgEncoding[] = [
  { type: 'image/png' },
  { type: 'image/webp', quality: 0.9 },
  { type: 'image/webp', quality: 0.75 },
  { type: 'image/webp', quality: 0.6 },
];

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
