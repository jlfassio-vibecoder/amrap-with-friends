/**
 * Campaign standings: normalised average + separate attendance.
 *
 * Per attended occurrence, score = athlete_final / best_final in that
 * occurrence (0–1). Rank on the mean of those ratios across attended
 * occurrences only; attendance is a second column, not mixed into the score.
 */

export type CampaignStandingsMember = {
  userId: string;
  nickname: string | null;
  /** Calendar date (YYYY-MM-DD) of join in the campaign timezone. */
  joinedLocalDate: string;
  left: boolean;
};

export type CampaignStandingsOccurrence = {
  occurrenceId: string;
  localDate: string;
  status: 'planned' | 'generated' | 'done' | 'skipped';
};

export type CampaignStandingsScore = {
  occurrenceId: string;
  userId: string;
  finalScore: number | null;
  /** True when the score came from a makeup session. */
  madeUp?: boolean;
};

export type CampaignStandingsInput = {
  members: CampaignStandingsMember[];
  occurrences: CampaignStandingsOccurrence[];
  scores: CampaignStandingsScore[];
};

export type CampaignStandingRow = {
  userId: string;
  nickname: string | null;
  /** Mean of per-occurrence ratios; null when the member attended nothing. */
  normalisedAverage: number | null;
  attended: number;
  eligible: number;
  left: boolean;
  /** True when at least one counted score came from a makeup session. */
  hasMadeUp: boolean;
  /** 1-based rank on normalised average; null averages sort last. */
  rank: number;
};

/**
 * A usable score, or null when the row carries no evidence the athlete
 * trained. The scheduler seeds a host participant into every generated
 * session, so a row without a real score means "absent", not "scored zero" —
 * counting those as attendance overstated attendance and averaged the
 * absences in as zeros.
 */
function scoreValue(finalScore: number | null | undefined): number | null {
  if (typeof finalScore !== 'number' || !Number.isFinite(finalScore)) {
    return null;
  }
  return Math.max(0, finalScore);
}

function isCountableStatus(status: CampaignStandingsOccurrence['status']): boolean {
  // Skipped sessions are still makeable; once settled they must count toward
  // eligibility and attendance the same way a done session does.
  return status === 'generated' || status === 'done' || status === 'skipped';
}

/**
 * Pure standings aggregation. Does not touch the network — the RPC returns
 * the raw members / occurrences / scores matrix and this owns the ranking rules.
 */
export function computeCampaignStandings(input: CampaignStandingsInput): CampaignStandingRow[] {
  const scoresByOccurrence = new Map<string, Map<string, number>>();
  const madeUpByOccurrence = new Map<string, Map<string, boolean>>();
  for (const entry of input.scores) {
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

  const bestByOccurrence = new Map<string, number>();
  for (const [occurrenceId, byUser] of scoresByOccurrence) {
    let best = 0;
    for (const value of byUser.values()) {
      if (value > best) {
        best = value;
      }
    }
    bestByOccurrence.set(occurrenceId, best);
  }

  const rows: Omit<CampaignStandingRow, 'rank'>[] = input.members.map((member) => {
    let attended = 0;
    let eligible = 0;
    let ratioSum = 0;
    let hasMadeUp = false;

    for (const occurrence of input.occurrences) {
      if (occurrence.localDate < member.joinedLocalDate) {
        continue;
      }
      if (!isCountableStatus(occurrence.status)) {
        continue;
      }

      eligible += 1;

      const byUser = scoresByOccurrence.get(occurrence.occurrenceId);
      if (!byUser || !byUser.has(member.userId)) {
        continue;
      }

      attended += 1;
      if (madeUpByOccurrence.get(occurrence.occurrenceId)?.get(member.userId)) {
        hasMadeUp = true;
      }
      const athlete = byUser.get(member.userId) ?? 0;
      const best = bestByOccurrence.get(occurrence.occurrenceId) ?? 0;
      // Single attendee (or everyone at zero): they are the best → 1.0.
      // Otherwise share of that occurrence's best.
      if (best <= 0) {
        ratioSum += 1;
      } else {
        ratioSum += athlete / best;
      }
    }

    return {
      userId: member.userId,
      nickname: member.nickname,
      normalisedAverage: attended === 0 ? null : ratioSum / attended,
      attended,
      eligible,
      left: member.left,
      hasMadeUp,
    };
  });

  rows.sort((a, b) => {
    if (a.normalisedAverage === null && b.normalisedAverage === null) {
      return (a.nickname ?? a.userId).localeCompare(b.nickname ?? b.userId);
    }
    if (a.normalisedAverage === null) {
      return 1;
    }
    if (b.normalisedAverage === null) {
      return -1;
    }
    if (b.normalisedAverage !== a.normalisedAverage) {
      return b.normalisedAverage - a.normalisedAverage;
    }
    return (a.nickname ?? a.userId).localeCompare(b.nickname ?? b.userId);
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
