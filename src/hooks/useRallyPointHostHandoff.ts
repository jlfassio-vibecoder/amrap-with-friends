import { useEffect, useRef } from 'react';
import { resumeSessionIdentity } from '@/lib/api/resumeSessionIdentity';
import {
  clearStoredHostToken,
  getStoredHostToken,
  setStoredHostToken,
} from '@/lib/sessionIdentity';

/**
 * Keeps local host_token in sync with rallyPoints.host_user_id during waiting/setup.
 * New host resumes identity; demoted host clears the token so waiting-room chrome remounts.
 */
export function useRallyPointHostHandoff(input: {
  hostUserId: string | null | undefined;
  activeSessionId: string | null | undefined;
  userId: string | null | undefined;
  enabled?: boolean;
  onHostAuthorityChange?: () => void;
}): void {
  const lastHandledRef = useRef<string | null>(null);
  const onChangeRef = useRef(input.onHostAuthorityChange);
  useEffect(() => {
    onChangeRef.current = input.onHostAuthorityChange;
  }, [input.onHostAuthorityChange]);

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const hostUserId = input.hostUserId;
    const activeSessionId = input.activeSessionId;
    const userId = input.userId;
    if (!hostUserId || !activeSessionId || !userId) {
      return;
    }

    const handoffKey = `${activeSessionId}:${hostUserId}`;
    if (lastHandledRef.current === handoffKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (hostUserId === userId) {
        const result = await resumeSessionIdentity(activeSessionId);
        if (cancelled) {
          return;
        }
        if (result.data?.hostToken) {
          setStoredHostToken(activeSessionId, result.data.hostToken);
          lastHandledRef.current = handoffKey;
          onChangeRef.current?.();
          return;
        }
        // Race: rotate may not be visible yet — leave key unlocked for a later retry.
        return;
      }

      if (getStoredHostToken(activeSessionId)) {
        clearStoredHostToken(activeSessionId);
        onChangeRef.current?.();
      }
      lastHandledRef.current = handoffKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [input.activeSessionId, input.enabled, input.hostUserId, input.userId]);
}
