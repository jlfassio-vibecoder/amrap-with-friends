import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRallyPoint,
  isLiveRallyPointMissionState,
  joinRallyPoint,
  type RallyPointMissionState,
} from '@/lib/api/rallyPoint';
import { getStoredRallyPointNickname } from '@/lib/rallyPointIdentity';
import { getStoredNickname } from '@/lib/missionIdentity';

const RETRY_MS = 2_500;
export const FORCE_NAV_DELAY_MS = 5_000;

export type RallyPointForceNavState = {
  pendingMissionId: string | null;
  secondsLeft: number;
  joinNow: () => void;
};

/**
 * When the rally point's active_mission_id points at a live mission the viewer is
 * not on, join and soft-nav (forced launch / straggler pull).
 *
 * Skips finished missions so `/rally-point/:id` stays reachable after AAR, and only
 * starts the countdown after joinRallyPoint succeeds so identity is persisted first.
 * Auto-nav after FORCE_NAV_DELAY_MS; Join now skips the remaining wait.
 */
export function useRallyPointForceNav(input: {
  rallyPointId: string | null | undefined;
  activeMissionId: string | null | undefined;
  /** From get_rally_point / snapshot when known; avoids a second round-trip. */
  activeMissionState?: RallyPointMissionState | null;
  /** Mission the viewer is currently watching; null on the rally point page. */
  currentMissionId?: string | null;
  enabled?: boolean;
  onError?: (message: string) => void;
}): RallyPointForceNavState {
  const navigate = useNavigate();
  const lastNavigatedRef = useRef<string | null>(null);
  const pendingTargetRef = useRef<string | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const [pendingMissionId, setPendingMissionId] = useState<string | null>(null);
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
    setPendingMissionId(null);
    setSecondsLeft(0);
    navigate(`/mission/${target}`, { replace: true });
  }, [clearDelayTimers, navigate]);

  const joinNow = useCallback(() => {
    navigateToPending();
  }, [navigateToPending]);

  useEffect(() => {
    if (input.enabled === false) {
      return;
    }
    const rallyPointId = input.rallyPointId;
    const target = input.activeMissionId;
    const onError = input.onError;
    if (!rallyPointId || !target) {
      return;
    }
    if (input.currentMissionId && input.currentMissionId === target) {
      return;
    }
    if (lastNavigatedRef.current === target) {
      return;
    }
    if (pendingTargetRef.current === target) {
      return;
    }

    const nickname =
      getStoredRallyPointNickname(rallyPointId) ?? getStoredNickname(target) ?? 'Athlete';

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

    function beginSoftNav(missionId: string) {
      if (cancelled) {
        return;
      }
      clearDelayTimers();
      pendingTargetRef.current = missionId;
      setPendingMissionId(missionId);
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

    async function attempt(knownState: RallyPointMissionState | null | undefined) {
      let state = knownState;
      if (!isLiveRallyPointMissionState(state)) {
        if (state === 'finished') {
          return;
        }
        const snapshot = await getRallyPoint(rallyPointId!);
        if (cancelled) {
          return;
        }
        if (snapshot.error || !snapshot.data) {
          onError?.(snapshot.error?.message ?? 'Could not join the next mission. Try again.');
          return;
        }
        if (snapshot.data.activeMissionId !== target) {
          return;
        }
        state = snapshot.data.activeMissionState;
        if (!isLiveRallyPointMissionState(state)) {
          return;
        }
      }

      const joined = await joinRallyPoint({ rallyPointId: rallyPointId!, nickname });
      if (cancelled) {
        return;
      }
      if (joined.error || !joined.data) {
        onError?.(joined.error?.message ?? 'Could not join the next mission. Try again.');
        scheduleRetry(state);
        return;
      }
      if (!joined.data.participantId) {
        onError?.('Could not join the next mission. Try again.');
        scheduleRetry(state);
        return;
      }
      const nextMissionId = joined.data.missionId ?? target!;
      if (nextMissionId !== target) {
        onError?.('Could not join the next mission. Try again.');
        scheduleRetry(state);
        return;
      }

      beginSoftNav(target!);
    }

    void attempt(input.activeMissionState);

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      clearDelayTimers();
      if (pendingTargetRef.current === target) {
        pendingTargetRef.current = null;
        setPendingMissionId(null);
        setSecondsLeft(0);
      }
    };
  }, [
    clearDelayTimers,
    input.activeMissionId,
    input.activeMissionState,
    input.currentMissionId,
    input.enabled,
    input.rallyPointId,
    input.onError,
    navigateToPending,
  ]);

  return { pendingMissionId, secondsLeft, joinNow };
}
