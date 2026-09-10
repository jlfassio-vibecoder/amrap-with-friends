import { sendContentEvent } from '@/lib/analytics/contentBeacon';

/**
 * What the pacing calculator reports.
 *
 * It differs from the free timer in a way that decides the whole design: the
 * input is prefilled and the result recomputes on every keystroke, so a valid
 * score exists for everyone the instant the page loads. Reporting "a score
 * happened" would therefore just be a second pageview, and reporting each
 * recomputation would be one event per keypress.
 *
 * The signal worth having is narrower — did they put *their own* splits in.
 * That is someone checking their real pacing against the product's own scoring,
 * which is the intent that matters, and it cannot happen by accident.
 */

/** The prefilled example. Exported so the component and the "did they edit it" test cannot drift. */
export const DEFAULT_SPLITS = '1:08 1:12 1:19 1:14 1:31';

export interface PacingScoreContext {
  capMinutes: number;
  roundCount: number;
  pvi: number | null;
  classification: string;
}

/** Whitespace-insensitive: retyping the example with different spacing is still the example. */
export function isOwnInput(raw: string, defaultRaw: string = DEFAULT_SPLITS): boolean {
  const normalise = (value: string) => value.trim().replace(/[\s,]+/g, ' ');
  return normalise(raw) !== normalise(defaultRaw) && normalise(raw).length > 0;
}

/**
 * Once per visit, not once per keystroke. The debounce in the component
 * decides *when*; this decides *whether*, so the rule is testable without a
 * timer.
 */
export function shouldReportPacingScore(state: {
  edited: boolean;
  hasResult: boolean;
  alreadyReported: boolean;
}): boolean {
  return state.edited && state.hasResult && !state.alreadyReported;
}

export function reportPacingScored(context: PacingScoreContext): void {
  sendContentEvent('pacing_calculator_scored', {
    cap_minutes: context.capMinutes,
    round_count: context.roundCount,
    pvi: context.pvi,
    classification: context.classification,
  });
}

export function reportPacingCtaClicked(
  placement: 'scored' | 'idle',
  context: PacingScoreContext
): void {
  sendContentEvent('pacing_calculator_cta_clicked', {
    placement,
    cap_minutes: context.capMinutes,
    round_count: context.roundCount,
    classification: context.classification,
  });
}
