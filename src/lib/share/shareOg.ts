/**
 * No `@/` alias and no imports: the edge runtime's tsconfig does not resolve
 * the alias, and pulling in timeline.ts would drag the whole renderer chain
 * into the middleware bundle for one line of formatting.
 */
function formatScore(rounds: number, reps: number): string {
  // countOf() from @/lib/units/plural, inlined for the same reason as the rest
  // of this file: the edge runtime does not resolve the alias. Keep the two in
  // step — this string and the card's hero are the same sentence in two places.
  const label = `${rounds} ${Math.abs(rounds) === 1 ? 'round' : 'rounds'}`;
  return reps > 0 ? `${label} + ${reps}` : label;
}

export interface ShareSummary {
  shareId: string;
  imagePath: string | null;
  /** Landscape render for twitter:image. Null on shares made before it existed. */
  wideImagePath: string | null;
  templateId: string | null;
  durationMinutes: number;
  rounds: number;
  reps: number;
}

/**
 * The unfurl text and image for a share link.
 *
 * Pure so it can be tested without the edge runtime: the middleware assembles
 * the HTML, this decides what goes in it. The distinction matters because the
 * fallbacks are the interesting part — a share whose image never uploaded, or
 * whose id does not exist, still has to produce a sensible card in a group
 * chat rather than a blank one.
 */
export function shareOgTitle(summary: ShareSummary | null): string {
  if (!summary) {
    return 'AMRAP With Friends';
  }
  return `${formatScore(summary.rounds, summary.reps)} · ${summary.durationMinutes} min AMRAP`;
}

export function shareOgDescription(summary: ShareSummary | null): string {
  return summary
    ? 'Run the same clock with friends and see everyone\u2019s rounds land live.'
    : 'Live group AMRAP workout timer.';
}

/**
 * The card if it uploaded, the default social image otherwise. Never a link to
 * a missing object: a broken image in a preview looks worse than the generic
 * one, and the generic one still says what the product is.
 */
/**
 * The dimensions to declare for whatever shareOgImage returned.
 *
 * A platform reads these before it has fetched the file, and uses them to
 * choose a layout. The card is the portrait story render (1080x1920) — saying
 * so is what lets a client that can show a tall image show the whole one
 * rather than assuming a landscape crop. The fallback is the site's own social
 * image, which is not the same shape.
 */
export function shareOgImageSize(summary: ShareSummary | null): {
  width: number;
  height: number;
} {
  return summary?.imagePath ? { width: 1080, height: 1920 } : { width: 1200, height: 630 };
}

export function shareOgImage(
  summary: ShareSummary | null,
  origin: string,
  supabaseUrl: string | null
): string {
  if (summary?.imagePath && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/mission-shares/${summary.imagePath}`;
  }
  return `${origin}/og-image-f.png`;
}

/**
 * The image X gets, which is not the image Facebook gets.
 *
 * og:image and twitter:image are separate tags because platforms crop
 * differently, and X is why. Facebook and Apple's Messages letterbox the 9:16
 * card and show all of it. X crops to roughly 1.9:1 out of the vertical
 * middle: measured on a posted card, that kept "540 reps", the movement list
 * and half the chart, and threw away the hero score, the athlete's name, the
 * link and the watermark — every part that says whose result it is.
 *
 * A landscape render survives that crop, so X is pointed at one. Shares made
 * before wide images existed fall back to the portrait card, which is what
 * they have always shown there; a missing image would be worse.
 */
export function shareTwitterImage(
  summary: ShareSummary | null,
  origin: string,
  supabaseUrl: string | null
): string {
  if (summary?.wideImagePath && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/mission-shares/${summary.wideImagePath}`;
  }
  return shareOgImage(summary, origin, supabaseUrl);
}
