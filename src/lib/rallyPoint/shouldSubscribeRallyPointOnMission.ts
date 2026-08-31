import type { LiveMissionPhase } from '@/lib/missionSync/types';

/**
 * Whether the waiting room should keep the Next Mission hub channel open.
 * Stay subscribed through finished so force-nav and daisy can see
 * activeMissionId / nextMissionPendingAt. Drop during work to avoid dual-channel fan-out.
 */
export function shouldSubscribeRallyPointOnMission(phase: LiveMissionPhase | string): boolean {
  return phase === 'waiting' || phase === 'setup' || phase === 'finished';
}
