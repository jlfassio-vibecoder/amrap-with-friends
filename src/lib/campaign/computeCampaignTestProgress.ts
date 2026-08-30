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
 */
export function computeCampaignTestProgress(
  input: CampaignTestProgressInput
): CampaignTestProgress | null {
  const { occurrences, members, scores } = input;
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
  }

  function scoreFor(occurrenceId: string, userId: string): number | null {
    return scoresByOccurrence.get(occurrenceId)?.get(userId) ?? null;
  }

  const rows: CampaignTestProgressRow[] = members.map((member) => {
    const joinedAfterBenchmark = member.joinedLocalDate > benchmark.localDate;
    const benchmarkScore = joinedAfterBenchmark
      ? null
      : scoreFor(benchmark.occurrenceId, member.userId);

    let retestScore: number | null = null;
    for (const index of retestIndices) {
      const occurrence = occurrences[index];
      if (member.joinedLocalDate > occurrence.localDate) {
        continue;
      }
      const value = scoreFor(occurrence.occurrenceId, member.userId);
      if (value !== null) {
        retestScore = value;
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

  return {
    rows,
    hasBenchmarkScore: rows.some((row) => row.benchmarkScore !== null),
  };
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
