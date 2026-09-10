import { fetchUnlockedAmqapMissions, type UnlockedAmqapMission } from '@/lib/api/myMissions';
import { submitParticipantResult } from '@/lib/api/missionSync';
import { filterUnlockedFinishedAmqap } from '@/lib/amqap/isUnlockedFinishedAmqap';

export type RepairUnlockedAmqapResult = {
  attempted: number;
  locked: number;
};

async function lockUnlockedAmqap(entry: UnlockedAmqapMission): Promise<boolean> {
  const result = await submitParticipantResult({
    missionId: entry.missionId,
    participantId: entry.participantId,
    claimToken: '',
    partialReps: 0,
    segmentIndex: entry.segmentIndex,
    modifiedMovements: [],
    movementVariants: {},
    rpe: null,
    sessionNotes: '',
    checkIns: {},
  });

  if (result.data?.ok === true) {
    return true;
  }
  // Already locked by a concurrent tab / remount — treat as success for HUD.
  if (result.data?.ok === false && result.data.reason === 'score_already_locked') {
    return true;
  }
  return false;
}

/**
 * Lock finished AMQAP missions that never submitted PartialReps so hud_telemetry
 * can count them (week / 7d / lastLockedAt / Active Recovery).
 */
export async function repairUnlockedAmqapScores(): Promise<RepairUnlockedAmqapResult> {
  const listed = await fetchUnlockedAmqapMissions();
  if (listed.error || !listed.data) {
    return { attempted: 0, locked: 0 };
  }

  const unlocked = filterUnlockedFinishedAmqap(listed.data);
  let locked = 0;
  for (const entry of unlocked) {
    if (await lockUnlockedAmqap(entry)) {
      locked += 1;
    }
  }

  return { attempted: unlocked.length, locked };
}
