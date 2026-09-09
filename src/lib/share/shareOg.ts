/**
 * No `@/` alias and no imports: the edge runtime's tsconfig does not resolve
 * the alias, and pulling in timeline.ts would drag the whole renderer chain
 * into the middleware bundle for one line of formatting.
 */
function formatScore(rounds: number, reps: number): string {
  return reps > 0 ? `${rounds} rounds + ${reps}` : `${rounds} rounds`;
}

export interface ShareSummary {
  shareId: string;
  imagePath: string | null;
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
