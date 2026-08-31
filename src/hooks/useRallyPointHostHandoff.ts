import { useEffect, useRef } from 'react';
import { resumeMissionIdentity } from '@/lib/api/resumeMissionIdentity';
import {
  clearStoredHostToken,
  getStoredHostToken,
  setStoredHostToken,
} from '@/lib/missionIdentity';

/**
 * Keeps local host_token in sync with rallyPoints.host_user_id during waiting/setup.
 * New host resumes identity; demoted host clears the token so waiting-room chrome remounts.
 */
export function useRallyPointHostHandoff(input: {
  hostUserId: string | null | undefined;
  activeMissionId: string | null | undefined;
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
    const activeMissionId = input.activeMissionId;
    const userId = input.userId;
    if (!hostUserId || !activeMissionId || !userId) {
      return;
    }

    const handoffKey = `${activeMissionId}:${hostUserId}`;
    if (lastHandledRef.current === handoffKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (hostUserId === userId) {
        const result = await resumeMissionIdentity(activeMissionId);
        if (cancelled) {
          return;
        }
        if (result.data?.hostToken) {
          setStoredHostToken(activeMissionId, result.data.hostToken);
          lastHandledRef.current = handoffKey;
          onChangeRef.current?.();
          return;
        }
        // Race: rotate may not be visible yet — leave key unlocked for a later retry.
        return;
      }

      if (getStoredHostToken(activeMissionId)) {
        clearStoredHostToken(activeMissionId);
        onChangeRef.current?.();
      }
      lastHandledRef.current = handoffKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [input.activeMissionId, input.enabled, input.hostUserId, input.userId]);
}
