import { useEffect, useState } from 'react';
import { SESSION_SAFETY_NOTICES, type SafetyNotice } from './sessionSafetyNotices';

export function useSessionSafetyNotices(sessionId: string): {
  activeNotice: SafetyNotice | null;
  safetyNoticesComplete: boolean;
  confirmSafetyNotice: () => void;
} {
  const [noticeIndex, setNoticeIndex] = useState(0);

  useEffect(() => {
    setNoticeIndex(0);
  }, [sessionId]);

  const safetyNoticesComplete = noticeIndex >= SESSION_SAFETY_NOTICES.length;
  const activeNotice = safetyNoticesComplete
    ? null
    : (SESSION_SAFETY_NOTICES[noticeIndex] ?? null);

  function confirmSafetyNotice() {
    setNoticeIndex((current) => current + 1);
  }

  return { activeNotice, safetyNoticesComplete, confirmSafetyNotice };
}
