export interface ToolConversionRow {
  cohortOrder: number;
  cohort: string;
  browsers: number;
  ctaClicks: number;
  signedUp: number;
  signupRatePct: number | null;
  trained: number;
  completedMission: number;
  completedRatePct: number | null;
}

export const TOOL_COHORT_LABELS: Record<string, string> = {
  reader_only: 'Read only — never touched a tool',
  timer_started: 'Started the free timer',
  timer_completed: 'Finished a free timer run',
  pacing_scored: 'Scored their own splits',
};

export function toolCohortLabel(cohort: string): string {
  return TOOL_COHORT_LABELS[cohort] ?? cohort;
}

/**
 * The comparison the tools exist to justify, in percentage points against the
 * readers who never touched one.
 *
 * Points rather than a multiple: "18 points better" stays legible when the
 * reader baseline is 2%, where "9x" would be an artefact of a small
 * denominator rather than a finding.
 */
export function toolLiftVsReaders(
  rows: ToolConversionRow[],
  cohort: string,
  metric: 'signupRatePct' | 'completedRatePct'
): number | null {
  const baseline = rows.find((row) => row.cohort === 'reader_only')?.[metric] ?? null;
  const target = rows.find((row) => row.cohort === cohort)?.[metric] ?? null;
  if (baseline === null || target === null) {
    return null;
  }
  return Math.round((target - baseline) * 10) / 10;
}

/**
 * Whether the numbers can carry a claim. Same floor as the social-lift panel,
 * and for the same reason: this decides whether to promote a page, and a
 * difference built on a handful of visitors should read as "not yet".
 */
export function toolLiftIsMeaningful(
  rows: ToolConversionRow[],
  cohort: string,
  minBrowsers = 20
): boolean {
  const baseline = rows.find((row) => row.cohort === 'reader_only');
  const target = rows.find((row) => row.cohort === cohort);
  return Boolean(
    baseline && target && baseline.browsers >= minBrowsers && target.browsers >= minBrowsers
  );
}
