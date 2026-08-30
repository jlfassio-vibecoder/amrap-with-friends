import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinLobby } from '@/lib/api/lobby';
import { getStoredLobbyNickname } from '@/lib/lobbyIdentity';
import { getStoredNickname } from '@/lib/sessionIdentity';
import { getSupabaseClient } from '@/lib/supabase';

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

    const nickname = getStoredLobbyNickname(lobbyId) ?? getStoredNickname(target) ?? 'Athlete';

    let cancelled = false;

    void (async () => {
      const supabase = getSupabaseClient();
      const { data: sessionRow } = await supabase
        .from('sessions')
        .select('state')
        .eq('id', target)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      const state =
        sessionRow && typeof sessionRow === 'object'
          ? (sessionRow as { state?: string }).state
          : null;
      if (state !== 'waiting' && state !== 'setup' && state !== 'work') {
        return;
      }

      const joined = await joinLobby({ lobbyId, nickname });
      if (cancelled || joined.error || !joined.data) {
        return;
      }

      lastNavigatedRef.current = target;
      navigate(`/session/${target}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [input.activeSessionId, input.currentSessionId, input.enabled, input.lobbyId, navigate]);
}
