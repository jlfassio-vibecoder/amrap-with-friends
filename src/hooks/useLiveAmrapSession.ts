import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateSessionState, logRound, submitParticipantResult } from '@/lib/api/sessionSync';
import { computeElapsedSecForLogRound } from '@/lib/amrapTimer/computeElapsedSecForLogRound';
import { PRACTICE_WORK_DURATION_SEC } from '@/lib/amrapTimer/constants';
import { selectElapsedSec } from '@/lib/amrapTimer/reducer';
import type { AmrapRoundLog, AmrapTimerPhase } from '@/lib/amrapTimer/types';
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
import { trackBeacon } from '@/lib/analytics/track';

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
  templateId: string | null;
  participantCount: number;
  segmentIndex: number;
  scheduledAt: string | null;
  lobbyCountdownEndsAt: string | null;
  repsPerRound: number;
  hasSubmittedPartialReps: boolean;
  leaderboard: LeaderboardEntry[];
  presence: SessionPresenceEntry[];
  isRealtimeConnected: boolean;
  lastAuthoritativeSyncAtMs: number | null;
  syncError: string | null;
  isPractice: boolean;
  practiceRounds: AmrapRoundLog[];
  start: () => Promise<void>;
  startPractice: () => void;
  endPractice: () => void;
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
  const [isPractice, setIsPractice] = useState(false);

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
      if (!isHost || !hostToken || !sessionId || isPractice) {
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
      isPractice,
      timer.phase,
      timer.timeLeftSec,
      timer.isPaused,
      timer.workStartedAtMs,
    ]
  );

  useEffect(() => {
    if (!isHost || isPractice) {
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
    isPractice,
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

  const practicePhase = mapTimerPhaseToSessionState(timer.phase);

  const displayPhase: LiveSessionPhase = isPractice
    ? practicePhase
    : isHost
      ? hostDisplayPhase
      : (joinerDisplay?.phase ?? session?.state ?? 'waiting');

  const displayTimeLeftSec = isPractice
    ? timer.timeLeftSec
    : isHost
      ? hostTimeLeftSec
      : (joinerDisplay?.timeLeftSec ?? session?.time_left_sec ?? setupDurationSec);

  const displayIsPaused = isPractice
    ? timer.phase === 'work' && timer.isPaused
    : isHost
      ? hostIsPaused
      : (joinerDisplay?.isPaused ?? session?.is_paused ?? false);

  const displayWorkStartedAtMs = isPractice || isHost
    ? timer.workStartedAtMs
    : (joinerDisplay?.workStartedAtMs ?? null);

  const displayElapsedSec = isPractice
    ? hostElapsedSec
    : isHost
      ? hostElapsedSec
      : joinerDisplay
        ? selectElapsedSecFromDisplay(joinerDisplay)
        : 0;

  const effectiveWorkDurationSec = isPractice
    ? timer.workDurationSec
    : workDurationSec;

  const workout = session?.workout ?? [];
  const templateId = session?.template_id ?? null;
  const participantCount = channel.participants.length;

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

  const abandonedFiredRef = useRef(false);

  useEffect(() => {
    abandonedFiredRef.current = false;
  }, [displayPhase]);

  useEffect(() => {
    if (isPractice) {
      return;
    }

    function fireAbandonedIfInWork() {
      if (displayPhase !== 'work' || abandonedFiredRef.current) {
        return;
      }
      abandonedFiredRef.current = true;
      trackBeacon(
        'session_abandoned',
        { time_left_sec: displayTimeLeftSec, round_count: myRoundCount },
        { sessionId, participantId }
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        fireAbandonedIfInWork();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', fireAbandonedIfInWork);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', fireAbandonedIfInWork);
    };
  }, [isPractice, displayPhase, displayTimeLeftSec, myRoundCount, sessionId, participantId]);

  const start = useCallback(async () => {
    if (isPractice || !isHost || displayPhase !== 'waiting' || !session) {
      return;
    }

    timer.start({
      setupDurationSec: setupDurationSec,
      workDurationSec: session.duration_minutes * 60,
    });
  }, [isPractice, isHost, displayPhase, session, timer, setupDurationSec]);

  const startPractice = useCallback(() => {
    if (isPractice) {
      return;
    }
    const sessionWaiting = (session?.state ?? 'waiting') === 'waiting';
    if (!sessionWaiting && displayPhase !== 'waiting') {
      return;
    }
    setIsPractice(true);
    timer.start({
      setupDurationSec,
      workDurationSec: PRACTICE_WORK_DURATION_SEC,
    });
  }, [isPractice, session?.state, displayPhase, timer, setupDurationSec]);

  const endPractice = useCallback(() => {
    if (!isPractice) {
      return;
    }
    setIsPractice(false);
    timer.reset();
  }, [isPractice, timer]);

  const pause = useCallback(async () => {
    if (timer.phase !== 'work' || timer.isPaused) {
      return;
    }
    if (!isPractice && !isHost) {
      return;
    }
    timer.pause();
  }, [isPractice, isHost, timer]);

  const resume = useCallback(async () => {
    if (timer.phase !== 'work' || !timer.isPaused) {
      return;
    }
    if (!isPractice && !isHost) {
      return;
    }
    timer.resume();
  }, [isPractice, isHost, timer]);

  const finish = useCallback(async () => {
    if (timer.phase !== 'work') {
      return;
    }
    if (!isPractice && !isHost) {
      return;
    }
    timer.finish();
  }, [isPractice, isHost, timer]);

  const logRoundAction = useCallback(async () => {
    if (displayPhase !== 'work' || displayIsPaused) {
      return;
    }

    if (isPractice) {
      timer.logRound();
      return;
    }

    if (!participantId) {
      return;
    }

    const tokenForRpc = claimToken ?? '';
    if (!tokenForRpc && !isAuthenticated) {
      return;
    }

    const elapsedSecAtRound = computeElapsedSecForLogRound({
      workDurationSec: effectiveWorkDurationSec,
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
    isPractice,
    timer,
    claimToken,
    isAuthenticated,
    participantId,
    effectiveWorkDurationSec,
    displayTimeLeftSec,
    displayWorkStartedAtMs,
    myRoundCount,
    sessionId,
    segmentIndex,
  ]);

  const submitPartialRepsAction = useCallback(
    async (partialReps: number) => {
      if (isPractice || !participantId || hasSubmittedPartialReps) {
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
      isPractice,
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
    workDurationSec: effectiveWorkDurationSec,
    setupDurationSec,
    isHost,
    participantId,
    nickname,
    sessionId,
    workout,
    templateId,
    participantCount,
    segmentIndex,
    scheduledAt: session?.scheduled_at ?? null,
    lobbyCountdownEndsAt: session?.lobby_countdown_ends_at ?? null,
    repsPerRound,
    hasSubmittedPartialReps: isPractice ? true : hasSubmittedPartialReps,
    leaderboard,
    presence,
    isRealtimeConnected: channel.isConnected,
    lastAuthoritativeSyncAtMs,
    syncError,
    isPractice,
    practiceRounds: isPractice ? timer.rounds : [],
    start,
    startPractice,
    endPractice,
    pause,
    resume,
    finish,
    logRound: logRoundAction,
    submitPartialReps: submitPartialRepsAction,
  };
}
