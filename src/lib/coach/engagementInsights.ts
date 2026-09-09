export interface MissionDropoffRow {
  bucketOrder: number;
  elapsedBucket: string;
  abandons: number;
  pctOfAbandons: number | null;
  medianElapsedPct: number | null;
  medianRounds: number | null;
}

export interface SocialLiftRow {
  cohort: string;
  participations: number;
  athletes: number;
  completed: number;
  completionRatePct: number | null;
  returnEligible: number;
  returnedWithin14d: number;
  returnRatePct: number | null;
  avgGroupSize: number | null;
}

export interface RetentionCell {
  cohortWeek: string;
  cohortSize: number;
  weekOffset: number;
  retained: number;
  retainedPct: number | null;
}

/**
 * The one sentence to read off the drop-off table.
 *
 * Quitting early and quitting late are opposite problems -- an early exit is
 * usually the workout being wrong for the athlete, a late one is usually the
 * clock or the log-round flow -- so the summary names which it is instead of
 * reporting an average that lands in the middle of both.
 */
export function dropoffHeadline(rows: MissionDropoffRow[]): string | null {
  const total = rows.reduce((sum, row) => sum + row.abandons, 0);
  if (total === 0) {
    return null;
  }
  const worst = rows.reduce((max, row) => (row.abandons > max.abandons ? row : max), rows[0]);
  const share = Math.round((100 * worst.abandons) / total);
  return `${share}% of abandonments happen in the ${worst.elapsedBucket.toLowerCase()}.`;
}

/**
 * Social lift as percentage points, not a ratio: "12 points better" survives a
 * small denominator in a way "1.4x" does not.
 */
export function socialLift(
  rows: SocialLiftRow[],
  metric: 'completionRatePct' | 'returnRatePct'
): { solo: number | null; social: number | null; deltaPoints: number | null } {
  const solo = rows.find((row) => row.cohort === 'solo')?.[metric] ?? null;
  const social = rows.find((row) => row.cohort === 'social')?.[metric] ?? null;
  const deltaPoints =
    solo === null || social === null ? null : Math.round((social - solo) * 10) / 10;
  return { solo, social, deltaPoints };
}

/**
 * Whether the numbers can carry a claim yet. The premise of the product is at
 * stake here, so a difference built on a handful of missions should read as
 * "not enough data" rather than as evidence either way.
 */
export function socialLiftIsMeaningful(rows: SocialLiftRow[], minPerCohort = 20): boolean {
  const solo = rows.find((row) => row.cohort === 'solo');
  const social = rows.find((row) => row.cohort === 'social');
  if (!solo || !social) {
    return false;
  }
  return solo.participations >= minPerCohort && social.participations >= minPerCohort;
}

/** Cohort rows, newest first, each with its offsets in ascending order — the shape a retention grid renders from. */
export function toRetentionGrid(
  cells: RetentionCell[]
): { cohortWeek: string; cohortSize: number; cells: RetentionCell[] }[] {
  const byWeek = new Map<
    string,
    { cohortWeek: string; cohortSize: number; cells: RetentionCell[] }
  >();
  for (const cell of cells) {
    const row = byWeek.get(cell.cohortWeek) ?? {
      cohortWeek: cell.cohortWeek,
      cohortSize: cell.cohortSize,
      cells: [],
    };
    row.cells.push(cell);
    byWeek.set(cell.cohortWeek, row);
  }
  return [...byWeek.values()]
    .map((row) => ({ ...row, cells: [...row.cells].sort((a, b) => a.weekOffset - b.weekOffset) }))
    .sort((a, b) => (a.cohortWeek < b.cohortWeek ? 1 : -1));
}

/**
 * Week-1 return rate across cohorts old enough to have one — the single number
 * that says whether training sticks. Week 0 is definitionally 100% (the cohort
 * is defined by training that week), so it is never the answer.
 */
export function weekOneReturnRate(cells: RetentionCell[]): number | null {
  const weekOnes = cells.filter((cell) => cell.weekOffset === 1);
  if (weekOnes.length === 0) {
    return null;
  }
  const cohortTotal = weekOnes.reduce((sum, cell) => sum + cell.cohortSize, 0);
  if (cohortTotal === 0) {
    return null;
  }
  const retained = weekOnes.reduce((sum, cell) => sum + cell.retained, 0);
  return Math.round((1000 * retained) / cohortTotal) / 10;
}
