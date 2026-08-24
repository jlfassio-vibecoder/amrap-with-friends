import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateSessionState, logRound, submitParticipantResult } from '@/lib/api/sessionSync';
import { computeElapsedSecForLogRound } from '@/lib/amrapTimer/computeElapsedSecForLogRound';
import { selectElapsedSec } from '@/lib/amrapTimer/reducer';
import type { AmrapTimerPhase } from '@/lib/amrapTimer/types';
import { useAmrapTimer } from '@/hooks/useAmrapTimer';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  buildLeaderboard,
  buildPresenceList,
} from '@/lib/realtime/sessionChannelUtils';
import type { UseSessionChannelResult } from '@/lib/realtime/useSessionChannel';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';
import {
  createAuthoritativeSnapshot,
  getSetupDurationSec,
  selectElapsedSecFromDisplay,
  snapshotToDisplay,
  type AuthoritativeSnapshot,
  type DisplayState,
} from '@/lib/sessionSync/reconcileDisplay';
import type {
  LeaderboardEntry,
  LiveSessionPhase,
  SessionPresenceEntry,
} from '@/lib/sessionSync/types';
import {
  getStoredClaimToken,
  getStoredHostToken,
  getStoredNickname,
  getStoredParticipantId,
} from '@/lib/sessionIdentity';

const PUSH_INTERVAL_MS = 3000;

export interface UseLiveAmrapSessionReturn {
  phase: LiveSessionPhase;
  timeLeftSec: number;
  elapsedSec: number;
  isPaused: boolean;
  workDurationSec: number;
  setupDurationSec: number;
  isHost: boolean;
  participantId: string;
  nickname: string;
  sessionId: string;
  workout: Array<{ name: string; target?: number; unit?: string }>;
  segmentIndex: number;
  repsPerRound: number;
  hasSubmittedPartialReps: boolean;
  leaderboard: LeaderboardEntry[];
  presence: SessionPresenceEntry[];
  isRealtimeConnected: boolean;
  lastAuthoritativeSyncAtMs: number | null;
  syncError: string | null;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  logRound: () => Promise<void>;
  submitPartialReps: (partialReps: number) => Promise<void>;
}

function mapTimerPhaseToSessionState(phase: AmrapTimerPhase): LiveSessionPhase {
  if (phase === 'idle') {
    return 'waiting';
  }
  return phase;
}

function mapHostDisplayPhase(
  timerPhase: AmrapTimerPhase,
  sessionState: LiveSessionPhase | undefined
): LiveSessionPhase {
  if (timerPhase === 'idle') {
    return sessionState ?? 'waiting';
  }
  return timerPhase;
}

export function useLiveAmrapSession(
  sessionId: string,
  channel: UseSessionChannelResult
): UseLiveAmrapSessionReturn {
  const participantId = getStoredParticipantId(sessionId) ?? '';
  const nickname = getStoredNickname(sessionId) ?? 'Unknown';
  const hostToken = getStoredHostToken(sessionId);
  const claimToken = getStoredClaimToken(sessionId);
  const isHost = hostToken !== null;

  const timer = useAmrapTimer();
  const { isAuthenticated } = useAmrapAuth();

  const [joinerSnapshot, setJoinerSnapshot] = useState<AuthoritativeSnapshot | null>(
    null
  );
  const [joinerDisplay, setJoinerDisplay] = useState<DisplayState | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastAuthoritativeSyncAtMs, setLastAuthoritativeSyncAtMs] = useState<
    number | null
  >(null);
  const [localPartialSubmitted, setLocalPartialSubmitted] = useState(false);

  const lastPushAtRef = useRef(0);
  const prevSessionStateRef = useRef<LiveSessionPhase | null>(null);
  const prevIsPausedRef = useRef(false);
  const pushInFlightRef = useRef(false);

  const session = channel.session;
  const segmentIndex = session?.segment_index ?? 0;
  const workDurationSec = session
    ? session.duration_minutes * 60
    : timer.workDurationSec;
  const setupDurationSec = getSetupDurationSec();

  useEffect(() => {
    if (channel.error) {
      setSyncError(channel.error);
    }
  }, [channel.error]);

  useEffect(() => {
    if (!isHost && session) {
      const nowMs = Date.now();
      const snapshot = createAuthoritativeSnapshot(
        {
          state: session.state,
          time_left_sec: session.time_left_sec,
          is_paused: session.is_paused,
          duration_minutes: session.duration_minutes,
          started_at: session.started_at,
          segment_index: session.segment_index,
        },
        nowMs
      );
      setJoinerSnapshot(snapshot);
      setJoinerDisplay(snapshotToDisplay(snapshot, nowMs));
      setLastAuthoritativeSyncAtMs(nowMs);
    }
    // Intentionally keyed on session fields, not session object identity (updates every realtime push).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcile when authoritative fields change
  }, [
    isHost,
    session?.state,
    session?.time_left_sec,
    session?.is_paused,
    session?.duration_minutes,
    session?.started_at,
    session?.segment_index,
  ]);

  useEffect(() => {
    if (isHost) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!joinerSnapshot) {
        return;
      }
      setJoinerDisplay(snapshotToDisplay(joinerSnapshot, Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, joinerSnapshot]);

  const pushHostState = useCallback(
    async (immediate: boolean) => {
      if (!isHost || !hostToken || !sessionId) {
        return;
      }

      const sessionState = mapTimerPhaseToSessionState(timer.phase);
      if (sessionState === 'waiting' && timer.phase === 'idle') {
        return;
      }

      const now = Date.now();
      if (!immediate && now - lastPushAtRef.current < PUSH_INTERVAL_MS) {
        return;
      }

      if (pushInFlightRef.current) {
        return;
      }

      pushInFlightRef.current = true;

      const startedAt =
        timer.workStartedAtMs !== null
          ? new Date(timer.workStartedAtMs).toISOString()
          : null;

      try {
        const result = await updateSessionState({
          sessionId,
          hostToken,
          state: sessionState,
          timeLeftSec: timer.timeLeftSec,
          isPaused: timer.isPaused,
          startedAt,
        });

        if (result.error) {
          setSyncError(result.error.message);
        } else if (result.data?.ok === false) {
          if (result.data.reason === 'invalid_host_token') {
            setSyncError('Host session token was rejected. Rejoin or create a new session.');
          }
        } else if (result.data?.ok === true) {
          lastPushAtRef.current = now;
          setLastAuthoritativeSyncAtMs(now);
        }
      } finally {
        pushInFlightRef.current = false;
      }
    },
    [
      isHost,
      hostToken,
      sessionId,
      timer.phase,
      timer.timeLeftSec,
      timer.isPaused,
      timer.workStartedAtMs,
    ]
  );

  useEffect(() => {
    if (!isHost) {
      return;
    }

    const sessionState = mapTimerPhaseToSessionState(timer.phase);
    if (sessionState === 'waiting' && timer.phase === 'idle') {
      prevSessionStateRef.current = 'waiting';
      prevIsPausedRef.current = false;
      return;
    }

    const prevState = prevSessionStateRef.current;
    const immediate =
      prevState !== null &&
      (prevState !== sessionState ||
        (sessionState === 'work' && prevIsPausedRef.current !== timer.isPaused));

    pushHostState(immediate);

    prevSessionStateRef.current = sessionState;
    prevIsPausedRef.current = timer.isPaused;
  }, [
    isHost,
    timer.phase,
    timer.timeLeftSec,
    timer.isPaused,
    pushHostState,
  ]);

  const hostDisplayPhase = mapHostDisplayPhase(timer.phase, session?.state);
  const hostTimeLeftSec =
    timer.phase === 'idle' ? (session?.time_left_sec ?? setupDurationSec) : timer.timeLeftSec;
  const hostIsPaused = timer.phase === 'work' ? timer.isPaused : false;
  const hostElapsedSec =
    timer.phase === 'idle' ? 0 : selectElapsedSec({
      phase: timer.phase,
      setupDurationSec: timer.setupDurationSec,
      workDurationSec: timer.workDurationSec,
      timeLeftSec: timer.timeLeftSec,
      isPaused: timer.isPaused,
      workStartedAtMs: timer.workStartedAtMs,
      rounds: timer.rounds,
    });

  const displayPhase: LiveSessionPhase = isHost
    ? hostDisplayPhase
    : (joinerDisplay?.phase ?? session?.state ?? 'waiting');

  const displayTimeLeftSec = isHost
    ? hostTimeLeftSec
    : (joinerDisplay?.timeLeftSec ?? session?.time_left_sec ?? setupDurationSec);

  const displayIsPaused = isHost
    ? hostIsPaused
    : (joinerDisplay?.isPaused ?? session?.is_paused ?? false);

  const displayWorkStartedAtMs = isHost
    ? timer.workStartedAtMs
    : (joinerDisplay?.workStartedAtMs ?? null);

  const displayElapsedSec = isHost
    ? hostElapsedSec
    : joinerDisplay
      ? selectElapsedSecFromDisplay(joinerDisplay)
      : 0;

  const workout = session?.workout ?? [];

  const repsPerRound = useMemo(() => {
    try {
      return computeRepsPerRound(workout);
    } catch {
      return 0;
    }
  }, [workout]);

  const hasSubmittedPartialReps = useMemo(() => {
    if (localPartialSubmitted) {
      return true;
    }
    return channel.segmentResults.some(
      (result) =>
        result.participant_id === participantId &&
        result.segment_index === segmentIndex
    );
  }, [
    localPartialSubmitted,
    channel.segmentResults,
    participantId,
    segmentIndex,
  ]);

  const myRoundCount = useMemo(() => {
    return channel.rounds.filter(
      (round) =>
        round.participant_id === participantId &&
        round.segment_index === segmentIndex
    ).length;
  }, [channel.rounds, participantId, segmentIndex]);

  const leaderboard = useMemo(
    () =>
      buildLeaderboard(
        channel.participants,
        channel.rounds,
        channel.segmentResults,
        segmentIndex,
        participantId,
        workout,
        session?.duration_minutes ?? workDurationSec / 60,
        displayPhase
      ),
    [
      channel.participants,
      channel.rounds,
      channel.segmentResults,
      segmentIndex,
      participantId,
      workout,
      session?.duration_minutes,
      workDurationSec,
      displayPhase,
    ]
  );

  const presence = useMemo(
    () =>
      buildPresenceList(channel.participants, channel.presenceByParticipantId),
    [channel.participants, channel.presenceByParticipantId]
  );

  const start = useCallback(async () => {
    if (!isHost || displayPhase !== 'waiting' || !session) {
      return;
    }

    timer.start({
      setupDurationSec: setupDurationSec,
      workDurationSec: session.duration_minutes * 60,
    });
  }, [isHost, displayPhase, session, timer, setupDurationSec]);

  const pause = useCallback(async () => {
    if (!isHost || timer.phase !== 'work' || timer.isPaused) {
      return;
    }
    timer.pause();
  }, [isHost, timer]);

  const resume = useCallback(async () => {
    if (!isHost || timer.phase !== 'work' || !timer.isPaused) {
      return;
    }
    timer.resume();
  }, [isHost, timer]);

  const finish = useCallback(async () => {
    if (!isHost || timer.phase !== 'work') {
      return;
    }
    timer.finish();
  }, [isHost, timer]);

  const logRoundAction = useCallback(async () => {
    if (displayPhase !== 'work' || displayIsPaused || !participantId) {
      return;
    }

    const tokenForRpc = claimToken ?? '';
    if (!tokenForRpc && !isAuthenticated) {
      return;
    }

    const elapsedSecAtRound = computeElapsedSecForLogRound({
      workDurationSec: workDurationSec,
      timeLeftSec: displayTimeLeftSec,
      phase: 'work',
      isPaused: displayIsPaused,
      workStartedAtMs: displayWorkStartedAtMs,
      roundCountInWork: myRoundCount,
      nowMs: Date.now(),
    });

    const result = await logRound({
      sessionId,
      participantId,
      claimToken: tokenForRpc,
      roundIndex: myRoundCount,
      elapsedSecAtRound,
      segmentIndex,
    });

    if (result.error) {
      setSyncError(result.error.message);
    } else if (result.data?.ok === false && result.data.reason !== 'duplicate_round') {
      setSyncError(`Could not log round: ${result.data.reason}`);
    }
  }, [
    displayPhase,
    displayIsPaused,
    claimToken,
    isAuthenticated,
    participantId,
    workDurationSec,
    displayTimeLeftSec,
    displayWorkStartedAtMs,
    myRoundCount,
    sessionId,
    segmentIndex,
  ]);

  const submitPartialRepsAction = useCallback(
    async (partialReps: number) => {
      if (!participantId || hasSubmittedPartialReps) {
        return;
      }

      const tokenForRpc = claimToken ?? '';
      if (!tokenForRpc && !isAuthenticated) {
        setSyncError(
          'Cannot submit score without a session credential. Rejoin the session or sign in.'
        );
        return;
      }

      const result = await submitParticipantResult({
        sessionId,
        participantId,
        claimToken: tokenForRpc,
        partialReps,
        segmentIndex,
      });

      if (result.error) {
        setSyncError(result.error.message);
        return;
      }

      if (result.data?.ok === false) {
        setSyncError(`Could not submit partial reps: ${result.data.reason}`);
        return;
      }

      setLocalPartialSubmitted(true);
    },
    [
      participantId,
      hasSubmittedPartialReps,
      claimToken,
      isAuthenticated,
      sessionId,
      segmentIndex,
    ]
  );

  return {
    phase: displayPhase,
    timeLeftSec: displayTimeLeftSec,
    elapsedSec: displayElapsedSec,
    isPaused: displayIsPaused,
    workDurationSec,
    setupDurationSec,
    isHost,
    participantId,
    nickname,
    sessionId,
    workout,
    segmentIndex,
    repsPerRound,
    hasSubmittedPartialReps,
    leaderboard,
    presence,
    isRealtimeConnected: channel.isConnected,
    lastAuthoritativeSyncAtMs,
    syncError,
    start,
    pause,
    resume,
    finish,
    logRound: logRoundAction,
    submitPartialReps: submitPartialRepsAction,
  };
}
