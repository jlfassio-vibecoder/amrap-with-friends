/**
 * Squad progress: who is on track vs who still has missions to make up.
 *
 * Attendance (so far) matches standings eligibility — countable statuses since
 * join with a usable score. Debt mirrors campaignMakeupQueue — terminal
 * done/skipped since join, unscored, not forfeited. No relative average, no
 * rank: the board is for nudging catch-up, not competition.
 */

import type { CampaignStandingsMember, CampaignStandingsScore } from './computeCampaignStandings';

export type SquadProgressOccurrence = {
  occurrenceId: string;
  sequence: number;
  localDate: string;
  status: 'planned' | 'generated' | 'done' | 'skipped';
};

export type SquadProgressForfeit = {
  occurrenceId: string;
  userId: string;
};

export type CampaignSquadProgressInput = {
  members: CampaignStandingsMember[];
  occurrences: SquadProgressOccurrence[];
  scores: CampaignStandingsScore[];
  forfeits?: SquadProgressForfeit[];
};

export type CampaignSquadProgressRow = {
  userId: string;
  nickname: string | null;
  left: boolean;
  attended: number;
  eligible: number;
  owedCount: number;
  /** Oldest owed calendar date, or null when on track. */
  oldestOwedLocalDate: string | null;
};

function hasUsableScore(finalScore: number | null | undefined): boolean {
  return typeof finalScore === 'number' && Number.isFinite(finalScore);
}

function isEligibleStatus(status: SquadProgressOccurrence['status']): boolean {
  return status === 'generated' || status === 'done' || status === 'skipped';
}

function isTerminalStatus(status: SquadProgressOccurrence['status']): boolean {
  return status === 'done' || status === 'skipped';
}

/** Plain-English status for the board. */
export function campaignSquadProgressStatusLabel(owedCount: number): string {
  if (owedCount <= 0) {
    return 'On track';
  }
  if (owedCount === 1) {
    return '1 to make up';
  }
  return `${owedCount} to make up`;
}

/**
 * Pure squad catch-up board. Hosts scan for “N to make up”; athletes see the
 * same list as social proof. Sorted debt-first for nudge priority.
 */
export function computeCampaignSquadProgress(
  input: CampaignSquadProgressInput
): CampaignSquadProgressRow[] {
  const scoredByUser = new Map<string, Set<string>>();
  for (const entry of input.scores) {
    if (!hasUsableScore(entry.finalScore)) {
      continue;
    }
    let ids = scoredByUser.get(entry.userId);
    if (!ids) {
      ids = new Set();
      scoredByUser.set(entry.userId, ids);
    }
    ids.add(entry.occurrenceId);
  }

  const forfeitByUser = new Map<string, Set<string>>();
  for (const row of input.forfeits ?? []) {
    let ids = forfeitByUser.get(row.userId);
    if (!ids) {
      ids = new Set();
      forfeitByUser.set(row.userId, ids);
    }
    ids.add(row.occurrenceId);
  }

  const rows: CampaignSquadProgressRow[] = input.members.map((member) => {
    const scored = scoredByUser.get(member.userId) ?? new Set<string>();
    const forfeits = forfeitByUser.get(member.userId) ?? new Set<string>();

    let attended = 0;
    let eligible = 0;
    let owedCount = 0;
    let oldestOwedLocalDate: string | null = null;
    let oldestOwedSequence = Number.POSITIVE_INFINITY;

    for (const occurrence of input.occurrences) {
      if (occurrence.localDate < member.joinedLocalDate) {
        continue;
      }

      if (isEligibleStatus(occurrence.status)) {
        eligible += 1;
        if (scored.has(occurrence.occurrenceId)) {
          attended += 1;
        }
      }

      if (!isTerminalStatus(occurrence.status)) {
        continue;
      }
      if (scored.has(occurrence.occurrenceId)) {
        continue;
      }
      if (forfeits.has(occurrence.occurrenceId)) {
        continue;
      }

      owedCount += 1;
      if (occurrence.sequence < oldestOwedSequence) {
        oldestOwedSequence = occurrence.sequence;
        oldestOwedLocalDate = occurrence.localDate;
      }
    }

    return {
      userId: member.userId,
      nickname: member.nickname,
      left: member.left,
      attended,
      eligible,
      owedCount,
      oldestOwedLocalDate,
    };
  });

  rows.sort((a, b) => {
    if (a.owedCount !== b.owedCount) {
      return b.owedCount - a.owedCount;
    }
    if (a.owedCount > 0) {
      const dateA = a.oldestOwedLocalDate ?? '';
      const dateB = b.oldestOwedLocalDate ?? '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
    }
    return (a.nickname ?? a.userId).localeCompare(b.nickname ?? b.userId);
  });

  return rows;
}
