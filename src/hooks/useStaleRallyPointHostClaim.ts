import { useEffect, useRef } from 'react';
import { claimRallyPointCommandIfStale } from '@/lib/api/rallyPoint';

const DEFAULT_STALE_CHECK_MS = 20_000;
const PRESENCE_CLAIM_DEBOUNCE_MS = 2_000;

export type StaleRallyPointHostClaimResult = {
  claimed: boolean;
  hostUserId: string | null;
  hostToken: string | null;
  activeMissionId: string | null;
  reason: string | null;
};

/**
 * Polls claim_rally_point_command_if_stale with stable deps so heartbeat-driven
 * rallyPoint refreshes do not reset the timer. Immediate attempt on enable.
 */
export function useStaleRallyPointHostClaim(input: {
  rallyPointId: string | null | undefined;
  hostUserId: string | null | undefined;
  userId: string | null | undefined;
  /** Host's rally_point_member_id when known; used for presence-triggered claim. */
  hostMemberId?: string | null;
  /** Presence map keyed by rally_point_member_id. */
  presenceByMemberId?: Record<string, unknown> | null;
  enabled?: boolean;
  intervalMs?: number;
  onClaimed?: (result: StaleRallyPointHostClaimResult) => void;
}): void {
  const onClaimedRef = useRef(input.onClaimed);
  useEffect(() => {
    onClaimedRef.current = input.onClaimed;
  }, [input.onClaimed]);

  const inFlightRef = useRef(false);
  const attemptRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const rallyPointId = input.rallyPointId;
    const hostUserId = input.hostUserId;
    const userId = input.userId;
    if (!rallyPointId || !hostUserId || !userId) {
      return;
    }
    if (hostUserId === userId) {
      return;
    }

    const intervalMs = input.intervalMs ?? DEFAULT_STALE_CHECK_MS;

    async function attempt() {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        const result = await claimRallyPointCommandIfStale(rallyPointId!);
        if (result.error || !result.data) {
          return;
        }
        if (result.data.claimed) {
          onClaimedRef.current?.(result.data);
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    attemptRef.current = attempt;

    void attempt();
    const id = window.setInterval(() => {
      void attempt();
    }, intervalMs);

    return () => {
      window.clearInterval(id);
      attemptRef.current = async () => {};
    };
  }, [input.enabled, input.hostUserId, input.intervalMs, input.rallyPointId, input.userId]);

  // Presence-triggered claim: host not in Realtime presence → debounced attempt.
  const hostPresentInPresence = Boolean(
    input.hostMemberId && input.presenceByMemberId?.[input.hostMemberId]
  );

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const rallyPointId = input.rallyPointId;
    const hostUserId = input.hostUserId;
    const userId = input.userId;
    if (!rallyPointId || !hostUserId || !userId || hostUserId === userId) {
      return;
    }
    if (!input.hostMemberId || hostPresentInPresence) {
      return;
    }

    const timer = window.setTimeout(() => {
      void attemptRef.current();
    }, PRESENCE_CLAIM_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    hostPresentInPresence,
    input.enabled,
    input.hostMemberId,
    input.hostUserId,
    input.rallyPointId,
    input.userId,
  ]);
}
