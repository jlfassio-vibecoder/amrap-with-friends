import { useState } from 'react';
import { MISSION_SAFETY_NOTICES, type SafetyNotice } from './missionSafetyNotices';
import { isMissionSafetyComplete, markMissionSafetyComplete } from './missionSafetyPrefs';

export function useMissionSafetyNotices(missionId: string): {
  activeNotice: SafetyNotice | null;
  safetyNoticesComplete: boolean;
  confirmSafetyNotice: () => void;
} {
  const [state, setState] = useState<{ missionId: string; noticeIndex: number }>(() => ({
    missionId,
    noticeIndex: isMissionSafetyComplete(missionId) ? MISSION_SAFETY_NOTICES.length : 0,
  }));

  const noticeIndex =
    state.missionId === missionId
      ? state.noticeIndex
      : isMissionSafetyComplete(missionId)
        ? MISSION_SAFETY_NOTICES.length
        : 0;

  const safetyNoticesComplete = noticeIndex >= MISSION_SAFETY_NOTICES.length;
  const activeNotice = safetyNoticesComplete ? null : (MISSION_SAFETY_NOTICES[noticeIndex] ?? null);

  function confirmSafetyNotice() {
    setState((current) => {
      const baseIndex = current.missionId === missionId ? current.noticeIndex : 0;
      const nextIndex = baseIndex + 1;
      if (nextIndex >= MISSION_SAFETY_NOTICES.length) {
        markMissionSafetyComplete(missionId);
      }
      return { missionId, noticeIndex: nextIndex };
    });
  }

  return { activeNotice, safetyNoticesComplete, confirmSafetyNotice };
}
