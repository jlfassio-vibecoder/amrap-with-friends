import { MAX_CAMPAIGN_TESTS, MIN_WEEKS_FOR_DELOAD } from './constants';

/**
 * What a session is for. `build` is the default and covers most of a campaign;
 * the other three are the shape the crew needs to understand before turning up.
 */
export type CampaignOccurrenceRole = 'benchmark' | 'retest' | 'deload' | 'build';

/** The minimum an occurrence has to carry for its role to be readable. */
export interface RoleReadableOccurrence {
  weekNumber: number;
  templateId: string | null;
}

/**
 * Recovers each session's role from the schedule alone.
 *
 * The role is not stored. It does not need to be: `planCampaignWorkouts` keeps
 * the benchmark out of the build rotation, so *the only sessions running the
 * first workout are the tests*, and a deload is by construction the session
 * before a test. That means the same rule reads a plan the host is previewing
 * and a campaign loaded back out of Postgres — no column, no migration, and no
 * way for a stored role to drift from the workout actually scheduled.
 */
export function deriveCampaignRoles(
  occurrences: RoleReadableOccurrence[]
): CampaignOccurrenceRole[] {
  const roles: CampaignOccurrenceRole[] = occurrences.map(() => 'build');
  if (occurrences.length === 0) {
    return roles;
  }

  const benchmarkId = occurrences[0].templateId;
  if (!benchmarkId) {
    return roles;
  }

  // A real programme finishes by repeating the opening workout. Mid-campaign
  // repeats without that end-cap are ordinary rotation noise (common on older
  // flat schedules) — do not invent tests or easy days for them.
  const finale = occurrences[occurrences.length - 1];
  if (finale.templateId !== benchmarkId) {
    return roles;
  }

  const testIndices = occurrences
    .map((occurrence, index) => (occurrence.templateId === benchmarkId ? index : -1))
    .filter((index) => index >= 0);

  // More repeats than any campaign length schedules means this is a plain
  // rotation that happened to come round again, not a test. Better to label
  // nothing than to promise a comparison the plan does not actually make.
  if (testIndices.length > MAX_CAMPAIGN_TESTS) {
    return roles;
  }

  for (const index of testIndices) {
    roles[index] = index === 0 ? 'benchmark' : 'retest';
  }

  const weekCount = occurrences.reduce(
    (max, occurrence) => Math.max(max, occurrence.weekNumber),
    0
  );
  if (weekCount < MIN_WEEKS_FOR_DELOAD) {
    return roles;
  }

  for (const index of testIndices) {
    const before = index - 1;
    if (before > 0 && roles[before] === 'build') {
      roles[before] = 'deload';
    }
  }

  return roles;
}

const ROLE_LABELS: Record<CampaignOccurrenceRole, string | null> = {
  benchmark: 'Benchmark',
  retest: 'Retest',
  deload: 'Easy day',
  build: null,
};

/** The badge to show beside a session, or null when it needs no explaining. */
export function campaignRoleLabel(role: CampaignOccurrenceRole): string | null {
  return ROLE_LABELS[role];
}

const ROLE_DESCRIPTIONS: Record<CampaignOccurrenceRole, string | null> = {
  benchmark: 'Your starting score. You run this one again at the end.',
  retest: 'The same workout as week one — this is where you see the difference.',
  deload: 'A light session before the retest, so the score measures fitness and not fatigue.',
  build: null,
};

export function campaignRoleDescription(role: CampaignOccurrenceRole): string | null {
  return ROLE_DESCRIPTIONS[role];
}
