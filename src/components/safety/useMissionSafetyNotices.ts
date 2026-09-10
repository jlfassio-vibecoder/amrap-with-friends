import { useState } from 'react';
import { MISSION_SAFETY_NOTICES, type SafetyNotice } from './missionSafetyNotices';

export function useMissionSafetyNotices(missionId: string): {
  activeNotice: SafetyNotice | null;
  safetyNoticesComplete: boolean;
  confirmSafetyNotice: () => void;
} {
  const [state, setState] = useState<{ missionId: string; noticeIndex: number }>({
    missionId,
    noticeIndex: 0,
  });

  const noticeIndex = state.missionId === missionId ? state.noticeIndex : 0;

  const safetyNoticesComplete = noticeIndex >= MISSION_SAFETY_NOTICES.length;
  const activeNotice = safetyNoticesComplete ? null : (MISSION_SAFETY_NOTICES[noticeIndex] ?? null);

  function confirmSafetyNotice() {
    setState((current) => {
      if (current.missionId !== missionId) {
        return { missionId, noticeIndex: 1 };
      }
      return { missionId, noticeIndex: current.noticeIndex + 1 };
    });
  }

  return { activeNotice, safetyNoticesComplete, confirmSafetyNotice };
}
