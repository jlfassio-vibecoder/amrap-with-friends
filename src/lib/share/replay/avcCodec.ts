/**
 * Picking an H.264 codec string that can actually hold the frame.
 *
 * An avc1 string encodes profile *and level*, and the level caps the coded
 * area. `avc1.42E01E` is Baseline level 3.0, whose limit is 1620 macroblocks —
 * fine for 720x576, and about a fifth of what a 1080x1920 story frame needs.
 * Configuring it fails asynchronously, through the encoder's error callback
 * rather than a throw, so a try/catch around configure() does not catch it and
 * the athlete sees the failure instead of a fallback.
 *
 * The arithmetic is here, and tested, because it is the part that was wrong.
 */

/** H.264 counts in 16x16 macroblocks, and rounds partial ones up — 1080 becomes 1088. */
export function macroblocksFor(width: number, height: number): number {
  return Math.ceil(width / 16) * Math.ceil(height / 16);
}

/** Level → maximum frame size in macroblocks, from the H.264 tables. */
export const AVC_LEVELS: { level: string; hex: string; maxFrameMacroblocks: number }[] = [
  { level: '3.0', hex: '1e', maxFrameMacroblocks: 1620 },
  { level: '3.1', hex: '1f', maxFrameMacroblocks: 3600 },
  { level: '3.2', hex: '20', maxFrameMacroblocks: 5120 },
  { level: '4.0', hex: '28', maxFrameMacroblocks: 8192 },
  { level: '4.2', hex: '2a', maxFrameMacroblocks: 8704 },
  { level: '5.0', hex: '32', maxFrameMacroblocks: 22080 },
  { level: '5.1', hex: '33', maxFrameMacroblocks: 36864 },
];

/**
 * Profile prefixes, most compatible first. Baseline plays everywhere and is
 * what a social upload is most likely to accept untouched; High compresses
 * better but is the one an old decoder refuses.
 */
const PROFILES = ['42e0', '4d40', '6400'] as const;

/**
 * Codec strings worth trying for this resolution, best-compatibility first.
 *
 * Only levels that can hold the frame are offered — the point of the exercise.
 * Lowest sufficient level first, because a higher level than needed can make a
 * decoder reject a file it could otherwise have played.
 */
export function avcCandidates(width: number, height: number): string[] {
  const needed = macroblocksFor(width, height);
  const levels = AVC_LEVELS.filter((entry) => entry.maxFrameMacroblocks >= needed);
  return levels.flatMap((entry) => PROFILES.map((profile) => `avc1.${profile}${entry.hex}`));
}
