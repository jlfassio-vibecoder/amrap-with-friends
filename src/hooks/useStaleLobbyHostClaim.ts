import { useEffect, useRef } from 'react';
import { claimLobbyCommandIfStale } from '@/lib/api/lobby';

const DEFAULT_STALE_CHECK_MS = 20_000;
const PRESENCE_CLAIM_DEBOUNCE_MS = 2_000;

export type StaleLobbyHostClaimResult = {
  claimed: boolean;
  hostUserId: string | null;
  hostToken: string | null;
  activeSessionId: string | null;
  reason: string | null;
};

/**
 * Polls claim_lobby_command_if_stale with stable deps so heartbeat-driven
 * lobby refreshes do not reset the timer. Immediate attempt on enable.
 */
export function useStaleLobbyHostClaim(input: {
  lobbyId: string | null | undefined;
  hostUserId: string | null | undefined;
  userId: string | null | undefined;
  /** Host's lobby_member_id when known; used for presence-triggered claim. */
  hostMemberId?: string | null;
  /** Presence map keyed by lobby_member_id. */
  presenceByMemberId?: Record<string, unknown> | null;
  enabled?: boolean;
  intervalMs?: number;
  onClaimed?: (result: StaleLobbyHostClaimResult) => void;
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
    const lobbyId = input.lobbyId;
    const hostUserId = input.hostUserId;
    const userId = input.userId;
    if (!lobbyId || !hostUserId || !userId) {
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
        const result = await claimLobbyCommandIfStale(lobbyId!);
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
  }, [input.enabled, input.hostUserId, input.intervalMs, input.lobbyId, input.userId]);

  // Presence-triggered claim: host not in Realtime presence → debounced attempt.
  const hostPresentInPresence = Boolean(
    input.hostMemberId && input.presenceByMemberId?.[input.hostMemberId]
  );

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const lobbyId = input.lobbyId;
    const hostUserId = input.hostUserId;
    const userId = input.userId;
    if (!lobbyId || !hostUserId || !userId || hostUserId === userId) {
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
    input.lobbyId,
    input.userId,
  ]);
}
