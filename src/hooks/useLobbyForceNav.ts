import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinLobby } from '@/lib/api/lobby';
import { getStoredLobbyNickname } from '@/lib/lobbyIdentity';
import { getStoredNickname } from '@/lib/sessionIdentity';

/**
 * When the lobby's active_session_id points at a different session than the
 * one the viewer is on, navigate into that session (forced launch / straggler pull).
 */
export function useLobbyForceNav(input: {
  lobbyId: string | null | undefined;
  activeSessionId: string | null | undefined;
  /** Session the viewer is currently watching; null on the lobby page. */
  currentSessionId?: string | null;
  enabled?: boolean;
}): void {
  const navigate = useNavigate();
  const lastNavigatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const lobbyId = input.lobbyId;
    const target = input.activeSessionId;
    if (!lobbyId || !target) {
      return;
    }
    if (input.currentSessionId && input.currentSessionId === target) {
      return;
    }
    if (lastNavigatedRef.current === target) {
      return;
    }
    lastNavigatedRef.current = target;

    const nickname =
      getStoredLobbyNickname(lobbyId) ?? getStoredNickname(target) ?? 'Athlete';

    void (async () => {
      await joinLobby({ lobbyId, nickname });
      navigate(`/session/${target}`, { replace: true });
    })();
  }, [
    input.activeSessionId,
    input.currentSessionId,
    input.enabled,
    input.lobbyId,
    navigate,
  ]);
}
