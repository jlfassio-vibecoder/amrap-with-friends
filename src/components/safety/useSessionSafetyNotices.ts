import { useState } from 'react';
import { SESSION_SAFETY_NOTICES, type SafetyNotice } from './sessionSafetyNotices';

export function useSessionSafetyNotices(sessionId: string): {
  activeNotice: SafetyNotice | null;
  safetyNoticesComplete: boolean;
  confirmSafetyNotice: () => void;
} {
  const [state, setState] = useState<{ sessionId: string; noticeIndex: number }>({
    sessionId,
    noticeIndex: 0,
  });

  const noticeIndex = state.sessionId === sessionId ? state.noticeIndex : 0;

  const safetyNoticesComplete = noticeIndex >= SESSION_SAFETY_NOTICES.length;
  const activeNotice = safetyNoticesComplete
    ? null
    : (SESSION_SAFETY_NOTICES[noticeIndex] ?? null);

  function confirmSafetyNotice() {
    setState((current) => {
      if (current.sessionId !== sessionId) {
        return { sessionId, noticeIndex: 1 };
      }
      return { sessionId, noticeIndex: current.noticeIndex + 1 };
    });
  }

  return { activeNotice, safetyNoticesComplete, confirmSafetyNotice };
}
