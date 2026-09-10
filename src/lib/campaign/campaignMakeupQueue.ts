/**
 * What an athlete owes on a campaign, derived from the schedule alone.
 *
 * An occurrence is owed when it is done or skipped, falls on or after the day
 * the athlete joined, they have no scored result for it, and they have not
 * forfeited it. A campaign_makeups row alone does not clear debt — starting a
 * makeup and leaving it in waiting still owes; only a usable score (live or
 * makeup) or an explicit Skip settles it. The next one they may settle (or
 * skip) is the lowest sequence among those — only the head of this list gets
 * “Make this up” / “Skip”.
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

export type MakeupQueueForfeit = {
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
  /**
   * Viewer's makeup rows. Kept for callers that need resume hints; an
   * unscored makeup does not remove the occurrence from the owe queue.
   */
  makeups: MakeupQueueMakeup[];
  /** Viewer's forfeited occurrence ids (explicit Skip). */
  forfeits?: MakeupQueueForfeit[];
};

function hasUsableScore(finalScore: number | null | undefined): boolean {
  return typeof finalScore === 'number' && Number.isFinite(finalScore);
}

/**
 * Owed occurrences oldest-first. Empty when the athlete is caught up.
 */
export function campaignMakeupQueue(input: MakeupQueueInput): MakeupQueueOccurrence[] {
  const forfeitIds = new Set((input.forfeits ?? []).map((row) => row.occurrenceId));
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
      if (forfeitIds.has(occurrence.occurrenceId)) {
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
