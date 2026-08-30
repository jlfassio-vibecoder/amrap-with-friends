import { useEffect, useRef } from 'react';
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

/**
 * When the lobby's active_session_id points at a live session the viewer is
 * not on, join and navigate (forced launch / straggler pull).
 *
 * Skips finished sessions so `/lobby/:id` stays reachable after AAR, and only
 * navigates after joinLobby succeeds so identity is persisted first.
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
}): void {
  const navigate = useNavigate();
  const lastNavigatedRef = useRef<string | null>(null);

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

      lastNavigatedRef.current = target!;
      navigate(`/session/${target}`, { replace: true });
    }

    void attempt(input.activeSessionState);

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    input.activeSessionId,
    input.activeSessionState,
    input.currentSessionId,
    input.enabled,
    input.lobbyId,
    input.onError,
    navigate,
  ]);
}
