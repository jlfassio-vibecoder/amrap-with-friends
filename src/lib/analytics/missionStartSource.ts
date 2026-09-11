export type MissionStartSource = 'countdown' | 'immediate' | 'chain';

export type RallyPointLeaveReason = 'started' | 'navigated_away' | 'closed';

/** Prefer chain over countdown when both apply (daisy-chain rest into Start). */
export function resolveMissionStartSource(input: {
  countdownArmed: boolean;
  hasChainRest: boolean;
}): MissionStartSource {
  if (input.hasChainRest) {
    return 'chain';
  }
  if (input.countdownArmed) {
    return 'countdown';
  }
  return 'immediate';
}

export function rallyPointStayDurationSec(enteredAtMs: number, leftAtMs: number): number {
  return Math.max(0, Math.floor((leftAtMs - enteredAtMs) / 1000));
}

export function isWaitingRoomPresenceState(state: string | null | undefined): boolean {
  return state === 'waiting' || state === 'setup';
}
