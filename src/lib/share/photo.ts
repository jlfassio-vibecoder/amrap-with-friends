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

/**
 * A second, local scrim behind the round-splits chart.
 *
 * The gradient above is fixed fractions of the card height, chosen for the
 * story ratio. The chart is not: where it lands moves with the ratio, with how
 * many lines the workout takes, and with whether a squad board reserved rows
 * beneath it. On the square card the gradient's lightest stretch fell straight
 * across the bars, and since the bars are drawn a shade *lighter* than the
 * card's near-black background, a photo brighter than that background inverts
 * the relationship and they stop reading as bars at all.
 *
 * So the band is placed at draw time from the chart's own rect rather than
 * guessed as a fraction, and it is feathered at both edges — a hard-edged
 * rectangle of darkness across a photo looks like a rendering fault.
 */
export interface ScrimBand {
  /** Peak darkness across the middle of the band. */
  alpha: number;
  /** How much of the band's height each fade occupies, as a fraction. */
  feather: number;
}

export function chartBandScrim(): ScrimBand {
  return { alpha: 0.72, feather: 0.18 };
}

/**
 * The band's stops, in canvas-gradient order: transparent, full, full,
 * transparent. Returned as offsets so the feather is one rule rather than four
 * numbers repeated at the call site.
 */
export function chartBandStops(band: ScrimBand = chartBandScrim()): ScrimStop[] {
  const feather = Math.min(0.45, Math.max(0, band.feather));
  return [
    { offset: 0, alpha: 0 },
    { offset: feather, alpha: band.alpha },
    { offset: 1 - feather, alpha: band.alpha },
    { offset: 1, alpha: 0 },
  ];
}

/**
 * Two photos, because the two cards are different shapes.
 *
 * One photo cover-fit into both was the first version, and the wide card gave
 * it away: a 3:4 phone photo centred into 1.78:1 keeps a horizontal band out
 * of the middle, so a head-and-shoulders shot arrives on X as a torso. The
 * portrait card has the opposite bias and keeps the face.
 *
 * Nothing here can fix that by cropping harder — the athlete has to be able to
 * say "this one for the tall card, that one for the wide one", or to say one
 * photo is fine for both and accept the crop knowingly.
 */
export type PhotoSlot = 'portrait' | 'wide';

/** Which slots an upload fills. `both` is the default: most athletes have one photo. */
export type PhotoTarget = PhotoSlot | 'both';

export const PHOTO_TARGETS: PhotoTarget[] = ['portrait', 'wide', 'both'];

export function slotsForTarget(target: PhotoTarget): PhotoSlot[] {
  return target === 'both' ? ['portrait', 'wide'] : [target];
}

/**
 * The slot a given card ratio draws from.
 *
 * Square sits between the two and takes the portrait photo: it crops a 3:4
 * photo top and bottom rather than sides, so the face survives, which is the
 * whole reason the split exists.
 */
export function slotForLayout(layout: 'story' | 'square' | 'landscape'): PhotoSlot {
  return layout === 'landscape' ? 'wide' : 'portrait';
}
