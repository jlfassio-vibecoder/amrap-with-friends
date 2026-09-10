/**
 * Which way out of a campaign the host is offered.
 *
 * Mirrors the rules `end_campaign` and `delete_campaign` enforce in Postgres.
 * The database is the authority — these decide which button to render, so the
 * host is never shown a control that is going to fail.
 */

/** Terminal statuses: nothing further can be done to the campaign. */
const CLOSED_STATUSES = new Set(['complete', 'abandoned']);

/** True once a campaign is over, whether it ran out or was ended early. */
export function isCampaignClosed(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}

export interface LifecycleOccurrence {
  status: string;
  missionId: string | null;
}

export interface CampaignLifecycleInput {
  /** 'host' for the owner; only the host gets either control. */
  viewerRole: string;
  status: string;
  occurrences: LifecycleOccurrence[];
  /** Active members including the host. */
  activeMemberCount: number;
}

/** True once any mission has been generated or run. */
export function hasCampaignStarted(occurrences: LifecycleOccurrence[]): boolean {
  return occurrences.some(
    (occurrence) => occurrence.status !== 'planned' || occurrence.missionId !== null
  );
}

/**
 * Ending is always available to the host of a live campaign — a plan you have
 * given up on is exactly the thing you need to be able to close.
 */
export function canEndCampaign(input: CampaignLifecycleInput): boolean {
  return input.viewerRole === 'host' && !isCampaignClosed(input.status);
}

/**
 * Renaming and re-goaling stay open for as long as the campaign is running.
 * Neither touches a workout, so neither can disturb the benchmark.
 */
export function canEditCampaign(input: CampaignLifecycleInput): boolean {
  return input.viewerRole === 'host' && !isCampaignClosed(input.status);
}

/**
 * A mission can be moved while it is still only a plan. Once the generator has
 * made it a mission the rally point is open and people may be on their way,
 * so the time stops being the host's to change.
 */
export function canRescheduleOccurrence(
  input: CampaignLifecycleInput,
  occurrence: LifecycleOccurrence
): boolean {
  return canEditCampaign(input) && occurrence.status === 'planned' && occurrence.missionId === null;
}

/**
 * Deleting is for a campaign that was never real: nothing has run and nobody
 * else has joined, so there is no history to lose and no one else's plan to
 * destroy. Anything further along ends instead.
 */
export function canDeleteCampaign(input: CampaignLifecycleInput): boolean {
  return (
    input.viewerRole === 'host' &&
    !isCampaignClosed(input.status) &&
    !hasCampaignStarted(input.occurrences) &&
    input.activeMemberCount <= 1
  );
}
