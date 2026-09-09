/**
 * The athlete's own photo behind the card.
 *
 * A result card is a picture of a number; a photo makes it a picture of a
 * person who did something. This is the geometry and the legibility rules for
 * putting one behind the text without wrecking either.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cover-fit: fill the frame entirely, crop the overflow, never distort.
 *
 * A phone photo is 4:3 or 3:4 and the story card is 9:16, so something must
 * be cropped — stretching a person to fit is the one outcome nobody wants.
 * Centred on both axes, which for a post-workout selfie keeps the subject in
 * frame far more often than anchoring to a corner.
 */
export function coverRect(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Rect {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { x: 0, y: 0, width: dstWidth, height: dstHeight };
  }
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { x: (dstWidth - width) / 2, y: (dstHeight - height) / 2, width, height };
}

/** Accepted image types. Anything else is rejected before it reaches a canvas. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Phones produce 3–12 MB photos; this is a sanity bound, not a quality one — the canvas is 1080 wide regardless. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export function photoRejectionReason(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type.toLowerCase())) {
    return 'That file is not a photo.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'That photo is too large.';
  }
  return null;
}

/**
 * How dark to make the scrim over the photo.
 *
 * The card's type is light on near-black, so over a bright photo it vanishes.
 * A flat wash would grey the picture out, so the scrim is strongest where the
 * text is — the top block and the footer — and lightest across the middle,
 * where the photo can breathe.
 */
export interface ScrimStop {
  offset: number;
  alpha: number;
}

export function scrimStops(): ScrimStop[] {
  return [
    { offset: 0, alpha: 0.86 },
    { offset: 0.45, alpha: 0.62 },
    { offset: 0.72, alpha: 0.72 },
    { offset: 1, alpha: 0.92 },
  ];
}
