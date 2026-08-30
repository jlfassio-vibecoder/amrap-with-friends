/**
 * What an athlete owes on a campaign, derived from the schedule alone.
 *
 * An occurrence is owed when it is done or skipped, falls on or after the day
 * the athlete joined, they have no scored result for it, and they have no
 * campaign_makeups row for it. The next one they may settle is the lowest
 * sequence among those — blocking is not a flag, only the head of this list
 * gets “Make this up”.
 */

export type MakeupQueueOccurrence = {
  occurrenceId: string;
  sequence: number;
  localDate: string;
  status: 'planned' | 'generated' | 'done' | 'skipped';
};

export type MakeupQueueMakeup = {
  occurrenceId: string;
};

export type MakeupQueueScore = {
  occurrenceId: string;
  userId: string;
  finalScore: number | null;
};

export type MakeupQueueInput = {
  occurrences: MakeupQueueOccurrence[];
  /** Calendar date (YYYY-MM-DD) of join in the campaign timezone. */
  viewerJoinedLocalDate: string;
  viewerUserId: string;
  scores: MakeupQueueScore[];
  makeups: MakeupQueueMakeup[];
};

function hasUsableScore(finalScore: number | null | undefined): boolean {
  return typeof finalScore === 'number' && Number.isFinite(finalScore);
}

/**
 * Owed occurrences oldest-first. Empty when the athlete is caught up.
 */
export function campaignMakeupQueue(input: MakeupQueueInput): MakeupQueueOccurrence[] {
  const makeupIds = new Set(input.makeups.map((row) => row.occurrenceId));
  const scoredIds = new Set(
    input.scores
      .filter((row) => row.userId === input.viewerUserId && hasUsableScore(row.finalScore))
      .map((row) => row.occurrenceId)
  );

  return input.occurrences
    .filter((occurrence) => {
      if (occurrence.status !== 'done' && occurrence.status !== 'skipped') {
        return false;
      }
      if (occurrence.localDate < input.viewerJoinedLocalDate) {
        return false;
      }
      if (scoredIds.has(occurrence.occurrenceId)) {
        return false;
      }
      if (makeupIds.has(occurrence.occurrenceId)) {
        return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
}

/** The only occurrence the athlete may settle right now, or null if caught up. */
export function campaignMakeupQueueHead(input: MakeupQueueInput): MakeupQueueOccurrence | null {
  return campaignMakeupQueue(input)[0] ?? null;
}
