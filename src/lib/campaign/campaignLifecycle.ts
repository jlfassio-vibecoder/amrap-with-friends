/**
 * Which way out of a campaign the host is offered.
 *
 * Mirrors the rules `end_campaign` and `delete_campaign` enforce in Postgres.
 * The database is the authority — these decide which button to render, so the
 * host is never shown a control that is going to fail.
 */

/** Terminal statuses: nothing further can be done to the campaign. */
const CLOSED_STATUSES = new Set(['complete', 'abandoned']);

export interface LifecycleOccurrence {
  status: string;
  sessionId: string | null;
}

export interface CampaignLifecycleInput {
  /** 'host' for the owner; only the host gets either control. */
  viewerRole: string;
  status: string;
  occurrences: LifecycleOccurrence[];
  /** Active members including the host. */
  activeMemberCount: number;
}

/** True once any session has been generated or run. */
export function hasCampaignStarted(occurrences: LifecycleOccurrence[]): boolean {
  return occurrences.some(
    (occurrence) => occurrence.status !== 'planned' || occurrence.sessionId !== null
  );
}

/**
 * Ending is always available to the host of a live campaign — a plan you have
 * given up on is exactly the thing you need to be able to close.
 */
export function canEndCampaign(input: CampaignLifecycleInput): boolean {
  return input.viewerRole === 'host' && !CLOSED_STATUSES.has(input.status);
}

/**
 * Deleting is for a campaign that was never real: nothing has run and nobody
 * else has joined, so there is no history to lose and no one else's plan to
 * destroy. Anything further along ends instead.
 */
export function canDeleteCampaign(input: CampaignLifecycleInput): boolean {
  return (
    input.viewerRole === 'host' &&
    !CLOSED_STATUSES.has(input.status) &&
    !hasCampaignStarted(input.occurrences) &&
    input.activeMemberCount <= 1
  );
}
