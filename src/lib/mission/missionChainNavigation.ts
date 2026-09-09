import type { LiveMissionPhase } from '@/lib/missionSync/types';
import { isLiveRallyPointMissionState } from '@/lib/api/rallyPoint';

/**
 * When the mission view may pull a viewer to the hub's current mission, and
 * when the host may advance a planned chain.
 *
 * Both used to be inline conditions in MissionWaitingRoomPage, and both shipped
 * a bug there — a joiner navigated out of result entry, and an abandoned chain
 * that relaunched itself when its old mission was reopened. They are pure
 * decisions over a handful of flags, which is exactly what this codebase keeps
 * in lib and tests.
 */

export interface ForceNavDecisionInput {
  rallyPointId: string | null | undefined;
  livePhase: LiveMissionPhase;
  isHost: boolean;
  /** The mission this page is showing. */
  currentMissionId: string;
  /** The mission the hub says is current, if the channel has it yet. */
  activeMissionId: string | null | undefined;
  activeMissionState: string | null | undefined;
  /** The host is holding a Continue button for a chain advance they triggered. */
  nextChainedMissionId: string | null;
  showPartialRepsModal: boolean;
  showScorecard: boolean;
}

export function shouldPullViewerToActiveMission(input: ForceNavDecisionInput): boolean {
  if (!input.rallyPointId) {
    return false;
  }

  // Nobody is navigated out of their own result entry. Losing the page mid-entry
  // discards the reps and the athlete's score for this mission is never
  // submitted at all — a worse outcome than arriving at the next mission late.
  const enteringResult = input.showPartialRepsModal || input.showScorecard;

  const hubMovedOn =
    Boolean(input.activeMissionId) && input.activeMissionId !== input.currentMissionId;

  if (input.livePhase === 'finished') {
    if (enteringResult) {
      return false;
    }
    // Stragglers after the after-action review, once the host is not sitting on
    // a Continue button of their own.
    if (!input.nextChainedMissionId) {
      return true;
    }
    // A chain advance created the next mission and it is already live: pull the
    // joiners across. The host keeps their Continue button instead.
    return !input.isHost && hubMovedOn && isLiveRallyPointMissionState(input.activeMissionState);
  }

  // Before and during work, the hub moving on means this page is stale — a
  // rematch, or a chain the viewer has fallen behind.
  return hubMovedOn;
}

export interface ChainAdvanceDecisionInput {
  isHost: boolean;
  isPractice: boolean;
  livePhase: LiveMissionPhase;
  rallyPointId: string | null | undefined;
  isAuthenticated: boolean;
  currentMissionId: string;
  activeMissionId: string | null | undefined;
  /** Set once an advance has been attempted for this mission. */
  attemptedForMissionId: string | null;
  /** Host must lock their score before daisy-chaining the next mission. */
  scoreLocked: boolean;
}

export function shouldAdvanceMissionChain(input: ChainAdvanceDecisionInput): boolean {
  if (!input.isHost || input.isPractice || input.livePhase !== 'finished') {
    return false;
  }
  if (!input.rallyPointId || !input.isAuthenticated) {
    return false;
  }
  if (!input.scoreLocked) {
    return false;
  }
  // Only from the mission the hub is actually on. A finished phase is not by
  // itself permission to start something: reopening mission 2 of an abandoned
  // chain from My Missions would otherwise launch mission 3 and drag everyone
  // still in the hub along with it.
  if (input.activeMissionId !== input.currentMissionId) {
    return false;
  }
  return input.attemptedForMissionId !== input.currentMissionId;
}
