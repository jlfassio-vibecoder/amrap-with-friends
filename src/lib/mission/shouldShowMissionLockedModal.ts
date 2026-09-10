import type { LiveMissionPhase } from '@/lib/missionSync/types';

/**
 * Whether the MISSION LOCKED modal should open on this phase change.
 *
 * Only a real transition into `setup` opens it — never a first paint that
 * lands there already, which is what a participant sees when they open the
 * rally link after Start was already pressed. `selectTacticalCue` applies
 * the same rule to the ignition audio cue, for the same reason: a snapshot
 * with no real prior phase is a page load, not a transition.
 *
 * Practice is a solo rehearsal, not a squad departure — "The squad has left
 * the Rally Point" would be false for the one person running it — so
 * practice never opens the modal, the same exclusion `MissionPacingGauge`
 * makes for its own reasons.
 */
export function shouldShowMissionLockedModal(input: {
  prevPhase: LiveMissionPhase | null;
  nextPhase: LiveMissionPhase;
  isPractice: boolean;
}): boolean {
  if (input.isPractice) {
    return false;
  }
  return input.nextPhase === 'setup' && input.prevPhase !== null && input.prevPhase !== 'setup';
}

/**
 * Whether an open MISSION LOCKED modal should close itself now.
 *
 * The countdown underneath never waits on this: setup ending closes the
 * modal on its own, the same as a tap does.
 */
export function shouldCloseMissionLockedModal(nextPhase: LiveMissionPhase): boolean {
  return nextPhase !== 'setup';
}
