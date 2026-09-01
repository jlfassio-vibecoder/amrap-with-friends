import type { LiveMissionPhase } from '@/lib/missionSync/types';

/**
 * Whether the waiting room should keep the Next Mission hub channel open.
 * Keep it through waiting/setup/work/finished so force-nav can pull joiners on
 * host Reset rematch (work) and daisy after AAR (finished).
 */
export function shouldSubscribeRallyPointOnMission(phase: LiveMissionPhase | string): boolean {
  return phase === 'waiting' || phase === 'setup' || phase === 'work' || phase === 'finished';
}
