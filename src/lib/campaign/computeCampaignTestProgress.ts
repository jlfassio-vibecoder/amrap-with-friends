import { isCampaignClosed } from './campaignLifecycle';
import { deriveCampaignRoles, type RoleReadableOccurrence } from './campaignRoles';
import type { CampaignStandingsMember, CampaignStandingsScore } from './computeCampaignStandings';

/**
 * Minimum an occurrence needs so we can find the benchmark / retests and join
 * scores from the standings matrix.
 */
export type TestProgressOccurrence = RoleReadableOccurrence & {
  occurrenceId: string;
  localDate: string;
};

export type CampaignTestProgressRow = {
  userId: string;
  nickname: string | null;
  left: boolean;
  benchmarkScore: number | null;
  retestScore: number | null;
  /** True when the Week 1 score came from a makeup mission. */
  benchmarkMadeUp: boolean;
  /** True when the latest retest score came from a makeup mission. */
  retestMadeUp: boolean;
  /** Latest scored retest minus benchmark; null when either side is missing. */
  delta: number | null;
};

export type CampaignTestProgress = {
  rows: CampaignTestProgressRow[];
  /** True once anyone has a finite Week 1 score. */
  hasBenchmarkScore: boolean;
};

export type CampaignTestProgressInput = {
  occurrences: TestProgressOccurrence[];
  members: CampaignStandingsMember[];
  scores: CampaignStandingsScore[];
  /**
   * The campaign's status. Only used to tell a test that has not happened yet
   * from one that never will — omit it and the section always shows.
   */
  campaignStatus?: string;
};

function scoreValue(finalScore: number | null | undefined): number | null {
  if (typeof finalScore !== 'number' || !Number.isFinite(finalScore)) {
    return null;
  }
  return Math.max(0, finalScore);
}

/**
 * Per-athlete Week 1 vs latest retest, using roles derived from the schedule.
 *
 * Returns null when the schedule has no recoverable benchmark — the detail
 * page then omits the section rather than promising a comparison it cannot make.
 *
 * Same reason, second case: a campaign that is over with no benchmark score is
 * never going to get one, so "Scores show up after the opening benchmark" would
 * be waiting for something that cannot arrive. A closed campaign that *does*
 * have a score keeps the section — a finished campaign's numbers are the whole
 * point of having run it, and an early ending does not make the work unreal.
 */
export function computeCampaignTestProgress(
  input: CampaignTestProgressInput
): CampaignTestProgress | null {
  const { occurrences, members, scores, campaignStatus } = input;
  if (occurrences.length === 0 || members.length === 0) {
    return null;
  }

  const roles = deriveCampaignRoles(occurrences);
  const benchmarkIndex = roles.findIndex((role) => role === 'benchmark');
  if (benchmarkIndex < 0) {
    return null;
  }

  const benchmark = occurrences[benchmarkIndex];
  const retestIndices = roles
    .map((role, index) => (role === 'retest' ? index : -1))
    .filter((index) => index >= 0);

  const scoresByOccurrence = new Map<string, Map<string, number>>();
  const madeUpByOccurrence = new Map<string, Map<string, boolean>>();
  for (const entry of scores) {
    const value = scoreValue(entry.finalScore);
    if (value === null) {
      continue;
    }
    let byUser = scoresByOccurrence.get(entry.occurrenceId);
    if (!byUser) {
      byUser = new Map();
      scoresByOccurrence.set(entry.occurrenceId, byUser);
    }
    byUser.set(entry.userId, value);

    let madeUpByUser = madeUpByOccurrence.get(entry.occurrenceId);
    if (!madeUpByUser) {
      madeUpByUser = new Map();
      madeUpByOccurrence.set(entry.occurrenceId, madeUpByUser);
    }
    madeUpByUser.set(entry.userId, entry.madeUp === true);
  }

  function scoreFor(occurrenceId: string, userId: string): number | null {
    return scoresByOccurrence.get(occurrenceId)?.get(userId) ?? null;
  }

  function madeUpFor(occurrenceId: string, userId: string): boolean {
    return madeUpByOccurrence.get(occurrenceId)?.get(userId) === true;
  }

  const rows: CampaignTestProgressRow[] = members.map((member) => {
    const joinedAfterBenchmark = member.joinedLocalDate > benchmark.localDate;
    const benchmarkScore = joinedAfterBenchmark
      ? null
      : scoreFor(benchmark.occurrenceId, member.userId);
    const benchmarkMadeUp =
      benchmarkScore !== null && madeUpFor(benchmark.occurrenceId, member.userId);

    let retestScore: number | null = null;
    let retestMadeUp = false;
    for (const index of retestIndices) {
      const occurrence = occurrences[index];
      if (member.joinedLocalDate > occurrence.localDate) {
        continue;
      }
      const value = scoreFor(occurrence.occurrenceId, member.userId);
      if (value !== null) {
        retestScore = value;
        retestMadeUp = madeUpFor(occurrence.occurrenceId, member.userId);
      }
    }

    const delta =
      benchmarkScore !== null && retestScore !== null ? retestScore - benchmarkScore : null;

    return {
      userId: member.userId,
      nickname: member.nickname,
      left: member.left,
      benchmarkScore,
      retestScore,
      benchmarkMadeUp,
      retestMadeUp,
      delta,
    };
  });

  rows.sort((a, b) => {
    if (a.delta === null && b.delta === null) {
      return (a.nickname ?? a.userId).localeCompare(b.nickname ?? b.userId);
    }
    if (a.delta === null) {
      return 1;
    }
    if (b.delta === null) {
      return -1;
    }
    if (b.delta !== a.delta) {
      return b.delta - a.delta;
    }
    return (a.nickname ?? a.userId).localeCompare(b.nickname ?? b.userId);
  });

  const hasBenchmarkScore = rows.some((row) => row.benchmarkScore !== null);

  if (!hasBenchmarkScore && campaignStatus !== undefined && isCampaignClosed(campaignStatus)) {
    return null;
  }

  return { rows, hasBenchmarkScore };
}

/** "42 reps" or an em dash when there is nothing to show. */
export function formatCampaignRepScore(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${value} reps`;
}

/** "+8 reps" / "−3 reps" / "0 reps" / "—". */
export function formatCampaignRepDelta(delta: number | null): string {
  if (delta === null) {
    return '—';
  }
  if (delta > 0) {
    return `+${delta} reps`;
  }
  if (delta < 0) {
    // Unicode minus so it matches the product copy style, not a hyphen-minus.
    return `−${Math.abs(delta)} reps`;
  }
  return '0 reps';
}
