import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLobby,
  isLiveLobbySessionState,
  joinLobby,
  type LobbySessionState,
} from '@/lib/api/lobby';
import { getStoredLobbyNickname } from '@/lib/lobbyIdentity';
import { getStoredNickname } from '@/lib/sessionIdentity';

const RETRY_MS = 2_500;
export const FORCE_NAV_DELAY_MS = 5_000;

export type LobbyForceNavState = {
  pendingSessionId: string | null;
  secondsLeft: number;
  joinNow: () => void;
};

/**
 * When the lobby's active_session_id points at a live session the viewer is
 * not on, join and soft-nav (forced launch / straggler pull).
 *
 * Skips finished sessions so `/lobby/:id` stays reachable after AAR, and only
 * starts the countdown after joinLobby succeeds so identity is persisted first.
 * Auto-nav after FORCE_NAV_DELAY_MS; Join now skips the remaining wait.
 */
export function useLobbyForceNav(input: {
  lobbyId: string | null | undefined;
  activeSessionId: string | null | undefined;
  /** From get_lobby / snapshot when known; avoids a second round-trip. */
  activeSessionState?: LobbySessionState | null;
  /** Session the viewer is currently watching; null on the lobby page. */
  currentSessionId?: string | null;
  enabled?: boolean;
  onError?: (message: string) => void;
}): LobbyForceNavState {
  const navigate = useNavigate();
  const lastNavigatedRef = useRef<string | null>(null);
  const pendingTargetRef = useRef<string | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const clearDelayTimers = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const navigateToPending = useCallback(() => {
    const target = pendingTargetRef.current;
    if (!target) {
      return;
    }
    clearDelayTimers();
    lastNavigatedRef.current = target;
    pendingTargetRef.current = null;
    setPendingSessionId(null);
    setSecondsLeft(0);
    navigate(`/session/${target}`, { replace: true });
  }, [clearDelayTimers, navigate]);

  const joinNow = useCallback(() => {
    navigateToPending();
  }, [navigateToPending]);

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const lobbyId = input.lobbyId;
    const target = input.activeSessionId;
    const onError = input.onError;
    if (!lobbyId || !target) {
      return;
    }
    if (input.currentSessionId && input.currentSessionId === target) {
      return;
    }
    if (lastNavigatedRef.current === target) {
      return;
    }
    if (pendingTargetRef.current === target) {
      return;
    }

    const nickname = getStoredLobbyNickname(lobbyId) ?? getStoredNickname(target) ?? 'Athlete';

    let cancelled = false;
    let retryTimer: number | null = null;

    function scheduleRetry(liveState: 'waiting' | 'setup' | 'work') {
      if (cancelled || retryTimer !== null) {
        return;
      }
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void attempt(liveState);
      }, RETRY_MS);
    }

    function beginSoftNav(sessionId: string) {
      if (cancelled) {
        return;
      }
      clearDelayTimers();
      pendingTargetRef.current = sessionId;
      setPendingSessionId(sessionId);
      const endsAt = Date.now() + FORCE_NAV_DELAY_MS;
      setSecondsLeft(Math.ceil(FORCE_NAV_DELAY_MS / 1000));

      tickTimerRef.current = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setSecondsLeft(remaining);
      }, 250);

      delayTimerRef.current = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        navigateToPending();
      }, FORCE_NAV_DELAY_MS);
    }

    async function attempt(knownState: LobbySessionState | null | undefined) {
      let state = knownState;
      if (!isLiveLobbySessionState(state)) {
        if (state === 'finished') {
          return;
        }
        const snapshot = await getLobby(lobbyId!);
        if (cancelled) {
          return;
        }
        if (snapshot.error || !snapshot.data) {
          onError?.(snapshot.error?.message ?? 'Could not join the next session. Try again.');
          return;
        }
        if (snapshot.data.activeSessionId !== target) {
          return;
        }
        state = snapshot.data.activeSessionState;
        if (!isLiveLobbySessionState(state)) {
          return;
        }
      }

      const joined = await joinLobby({ lobbyId: lobbyId!, nickname });
      if (cancelled) {
        return;
      }
      if (joined.error || !joined.data) {
        onError?.(joined.error?.message ?? 'Could not join the next session. Try again.');
        scheduleRetry(state);
        return;
      }
      if (!joined.data.participantId) {
        onError?.('Could not join the next session. Try again.');
        scheduleRetry(state);
        return;
      }
      const nextSessionId = joined.data.sessionId ?? target!;
      if (nextSessionId !== target) {
        onError?.('Could not join the next session. Try again.');
        scheduleRetry(state);
        return;
      }

      beginSoftNav(target!);
    }

    void attempt(input.activeSessionState);

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      clearDelayTimers();
      if (pendingTargetRef.current === target) {
        pendingTargetRef.current = null;
        setPendingSessionId(null);
        setSecondsLeft(0);
      }
    };
  }, [
    clearDelayTimers,
    input.activeSessionId,
    input.activeSessionState,
    input.currentSessionId,
    input.enabled,
    input.lobbyId,
    input.onError,
    navigateToPending,
  ]);

  return { pendingSessionId, secondsLeft, joinNow };
}
