import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateMissionState, logRound, submitParticipantResult } from '@/lib/api/missionSync';
import { shouldResyncAfterLog } from '@/lib/missionSync/roundResync';
import { resetLiveMission } from '@/lib/api/resetLiveMission';
import { computeElapsedSecForLogRound } from '@/lib/amrapTimer/computeElapsedSecForLogRound';
import {
  computeMissedRoundElapsedSec,
  type MissedRoundEstimate,
} from '@/lib/amrapTimer/computeMissedRoundElapsedSec';
import { PRACTICE_WORK_DURATION_SEC } from '@/lib/amrapTimer/constants';
import { selectElapsedSec } from '@/lib/amrapTimer/reducer';
import type { AmrapRoundLog, AmrapTimerPhase } from '@/lib/amrapTimer/types';
import { useAmrapTimer } from '@/hooks/useAmrapTimer';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { buildLeaderboard, buildPresenceList } from '@/lib/realtime/missionChannelUtils';
import { buildParticipantRoster } from '@/lib/missionSync/buildParticipantRoster';
import type { UseMissionChannelResult } from '@/lib/realtime/useMissionChannel';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';
import {
  createAuthoritativeSnapshot,
  getSetupDurationSec,
  selectElapsedSecFromDisplay,
  snapshotToDisplay,
  type AuthoritativeSnapshot,
  type DisplayState,
} from '@/lib/missionSync/reconcileDisplay';
import type {
  LeaderboardEntry,
  LiveMissionPhase,
  MissionPresenceEntry,
} from '@/lib/missionSync/types';
import {
  getStoredClaimToken,
  getStoredHostToken,
  getStoredNickname,
  getStoredParticipantId,
  persistMissionIdentity,
} from '@/lib/missionIdentity';
import { track, trackBeacon } from '@/lib/analytics/track';
import type { MissionStartSource } from '@/lib/analytics/missionStartSource';

const PUSH_INTERVAL_MS = 15_000;

export interface UseLiveAmrapMissionReturn {
  phase: LiveMissionPhase;
  timeLeftSec: number;
  elapsedSec: number;
  /** Cumulative elapsed-at-round seconds for this athlete, oldest first. */
  roundSplitsSec: number[];
  isPaused: boolean;
  workDurationSec: number;
  setupDurationSec: number;
  isHost: boolean;
  participantId: string;
  nickname: string;
  missionId: string;
  workout: Array<{ name: string; target?: number; unit?: string }>;
  templateId: string | null;
  participantCount: number;
  segmentIndex: number;
  scheduledAt: string | null;
  rallyPointCountdownEndsAt: string | null;
  repsPerRound: number;
  hasSubmittedPartialReps: boolean;
  leaderboard: LeaderboardEntry[];
  presence: MissionPresenceEntry[];
  /** 1-based rank on the score board, or null before this athlete has one. */
  selfRank: number | null;
  isRealtimeConnected: boolean;
  lastAuthoritativeSyncAtMs: number | null;
  syncError: string | null;
  isPractice: boolean;
  practiceRounds: AmrapRoundLog[];
  start: (options?: { source?: MissionStartSource }) => Promise<void>;
  startPractice: () => void;
  endPractice: () => void;
  /** Live host rematch (new mission id) or practice local restart. */
  resetMission: () => Promise<{
    missionId: string | null;
    error: string | null;
  }>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  logRound: () => Promise<boolean>;
  /** What a missed-log correction would do, for the confirm step. Never commits. */
  previewMissedRound: (repsIntoNextRound: number) => MissedRoundEstimate;
  logMissedRound: (repsIntoNextRound: number) => Promise<boolean>;
  /** False when the workout has no countable reps, so no correction can be inferred. */
  canLogMissedRound: boolean;
  /** Rounds this athlete has logged in the current segment. */
  myRoundCount: number;
  submitPartialReps: (
    partialReps: number,
    modifiedMovements?: string[],
    movementVariants?: Record<string, string>,
    checkIn?: {
      rpe: number | null;
      sessionNotes: string;
      checkIns: Record<string, string>;
    }
  ) => Promise<boolean>;
}

function mapTimerPhaseToMissionState(phase: AmrapTimerPhase): LiveMissionPhase {
  if (phase === 'idle') {
    return 'waiting';
  }
  return phase;
}

function mapHostDisplayPhase(
  timerPhase: AmrapTimerPhase,
  missionState: LiveMissionPhase | undefined
): LiveMissionPhase {
  if (timerPhase === 'idle') {
    return missionState ?? 'waiting';
  }
  return timerPhase;
}

export function useLiveAmrapMission(
  missionId: string,
  channel: UseMissionChannelResult
): UseLiveAmrapMissionReturn {
  const participantId = getStoredParticipantId(missionId) ?? '';
  const nickname = getStoredNickname(missionId) ?? 'Unknown';
  const hostToken = getStoredHostToken(missionId);
  const claimToken = getStoredClaimToken(missionId);
  const isHost = hostToken !== null;

  const timer = useAmrapTimer();
  const { isAuthenticated, user } = useAmrapAuth();

  const [joinerSnapshot, setJoinerSnapshot] = useState<AuthoritativeSnapshot | null>(null);
  const [joinerDisplay, setJoinerDisplay] = useState<DisplayState | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastAuthoritativeSyncAtMs, setLastAuthoritativeSyncAtMs] = useState<number | null>(null);
  const [localPartialSubmitted, setLocalPartialSubmitted] = useState(false);
  const [isPractice, setIsPractice] = useState(false);

  const lastPushAtRef = useRef(0);
  const prevMissionStateRef = useRef<LiveMissionPhase | null>(null);
  const prevIsPausedRef = useRef(false);
  const pushInFlightRef = useRef(false);
  const missionStartedFiredRef = useRef(false);
  const startSourceRef = useRef<MissionStartSource>('immediate');

  useEffect(() => {
    missionStartedFiredRef.current = false;
    startSourceRef.current = 'immediate';
  }, [missionId]);

  const mission = channel.mission;
  const segmentIndex = mission?.segment_index ?? 0;
  const workDurationSec = mission ? mission.duration_minutes * 60 : timer.workDurationSec;
  const setupDurationSec = getSetupDurationSec();

  useEffect(() => {
    if (channel.error) {
      setSyncError(channel.error);
    }
  }, [channel.error]);

  useEffect(() => {
    if (!isHost && mission) {
      const nowMs = Date.now();
      const snapshot = createAuthoritativeSnapshot(
        {
          state: mission.state,
          time_left_sec: mission.time_left_sec,
          is_paused: mission.is_paused,
          duration_minutes: mission.duration_minutes,
          started_at: mission.started_at,
          segment_index: mission.segment_index,
          is_featured: mission.is_featured,
          scheduled_at: mission.scheduled_at,
        },
        nowMs
      );
      const nextDisplay = snapshotToDisplay(snapshot, nowMs);

      if (
        joinerDisplay &&
        joinerDisplay.phase === nextDisplay.phase &&
        (nextDisplay.phase === 'setup' || nextDisplay.phase === 'work')
      ) {
        const driftSec = joinerDisplay.timeLeftSec - nextDisplay.timeLeftSec;
        if (driftSec !== 0) {
          track(
            'realtime_correction',
            { phase: nextDisplay.phase, drift_sec: driftSec },
            { missionId, participantId }
          );
        }
      }

      setJoinerSnapshot(snapshot);
      setJoinerDisplay(nextDisplay);
      setLastAuthoritativeSyncAtMs(nowMs);
    }
    // Intentionally keyed on mission fields, not mission object identity (updates every realtime push).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcile when authoritative fields change
  }, [
    isHost,
    mission?.state,
    mission?.time_left_sec,
    mission?.is_paused,
    mission?.duration_minutes,
    mission?.started_at,
    mission?.segment_index,
    mission?.is_featured,
    mission?.scheduled_at,
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

  // Featured reclaim: coach opens an already-running hostless mission with
  // host_token — seed the local timer so they can pause/finish and push ticks.
  useEffect(() => {
    if (isPractice || !isHost || !mission || timer.phase !== 'idle') {
      return;
    }
    if (!mission.is_featured) {
      return;
    }
    if (mission.state !== 'setup' && mission.state !== 'work') {
      return;
    }

    const nowMs = Date.now();
    const snapshot = createAuthoritativeSnapshot(
      {
        state: mission.state,
        time_left_sec: mission.time_left_sec,
        is_paused: mission.is_paused,
        duration_minutes: mission.duration_minutes,
        started_at: mission.started_at,
        segment_index: mission.segment_index,
        is_featured: mission.is_featured,
        scheduled_at: mission.scheduled_at,
      },
      nowMs
    );
    const display = snapshotToDisplay(snapshot, nowMs);
    if (display.phase !== 'setup' && display.phase !== 'work') {
      return;
    }

    timer.hydrate({
      phase: display.phase,
      setupDurationSec: setupDurationSec,
      workDurationSec: mission.duration_minutes * 60,
      timeLeftSec: display.timeLeftSec,
      workStartedAtMs: display.workStartedAtMs,
      isPaused: display.isPaused,
    });
  }, [
    isPractice,
    isHost,
    mission,
    mission?.state,
    mission?.time_left_sec,
    mission?.is_paused,
    mission?.duration_minutes,
    mission?.started_at,
    mission?.is_featured,
    mission?.scheduled_at,
    timer.phase,
    timer,
    setupDurationSec,
  ]);
  const pushHostState = useCallback(
    async (immediate: boolean) => {
      if (!isHost || !hostToken || !missionId || isPractice) {
        return;
      }

      const missionState = mapTimerPhaseToMissionState(timer.phase);
      if (missionState === 'waiting' && timer.phase === 'idle') {
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
        timer.workStartedAtMs !== null ? new Date(timer.workStartedAtMs).toISOString() : null;

      try {
        const priorMissionState = channel.mission?.state ?? null;
        const result = await updateMissionState({
          missionId,
          hostToken,
          state: missionState,
          timeLeftSec: timer.timeLeftSec,
          isPaused: timer.isPaused,
          startedAt,
        });

        if (result.error) {
          setSyncError(result.error.message);
        } else if (result.data?.ok === false) {
          if (result.data.reason === 'invalid_host_token') {
            setSyncError('Host mission token was rejected. Rejoin or create a new mission.');
          }
        } else if (result.data?.ok === true) {
          lastPushAtRef.current = now;
          setLastAuthoritativeSyncAtMs(now);
          const startedFromWaitingRoom =
            priorMissionState === 'waiting' || priorMissionState === 'setup';
          if (
            missionState === 'work' &&
            startedFromWaitingRoom &&
            !missionStartedFiredRef.current
          ) {
            missionStartedFiredRef.current = true;
            track(
              'mission_started',
              {
                source: startSourceRef.current,
                is_host: true,
                participant_count: channel.participants.length,
              },
              {
                missionId,
                participantId: participantId || undefined,
                // Copilot suggestion ignored: userId already attached for activation cohort joins.
                userId: user?.id ?? null,
              }
            );
          }
        }
      } finally {
        pushInFlightRef.current = false;
      }
    },
    [
      isHost,
      hostToken,
      missionId,
      isPractice,
      timer.phase,
      timer.timeLeftSec,
      timer.isPaused,
      timer.workStartedAtMs,
      channel.participants.length,
      // Copilot suggestion ignored: once-per-mission storage boundary; waiting→work + ref is enough.
      channel.mission?.state,
      participantId,
      user?.id,
    ]
  );

  useEffect(() => {
    if (!isHost || isPractice) {
      return;
    }

    const missionState = mapTimerPhaseToMissionState(timer.phase);
    if (missionState === 'waiting' && timer.phase === 'idle') {
      prevMissionStateRef.current = 'waiting';
      prevIsPausedRef.current = false;
      return;
    }

    const prevState = prevMissionStateRef.current;
    const immediate =
      prevState !== null &&
      (prevState !== missionState ||
        (missionState === 'work' && prevIsPausedRef.current !== timer.isPaused));

    pushHostState(immediate);

    prevMissionStateRef.current = missionState;
    prevIsPausedRef.current = timer.isPaused;
  }, [isHost, isPractice, timer.phase, timer.timeLeftSec, timer.isPaused, pushHostState]);

  const hostDisplayPhase = mapHostDisplayPhase(timer.phase, mission?.state);
  const hostTimeLeftSec =
    timer.phase === 'idle' ? (mission?.time_left_sec ?? setupDurationSec) : timer.timeLeftSec;
  const hostIsPaused = timer.phase === 'work' ? timer.isPaused : false;
  const hostElapsedSec =
    timer.phase === 'idle'
      ? 0
      : selectElapsedSec({
          phase: timer.phase,
          setupDurationSec: timer.setupDurationSec,
          workDurationSec: timer.workDurationSec,
          timeLeftSec: timer.timeLeftSec,
          isPaused: timer.isPaused,
          workStartedAtMs: timer.workStartedAtMs,
          setupStartedAtMs: null,
          pausedAccumMs: timer.pausedAccumMs,
          pausedAtMs: null,
          rounds: timer.rounds,
        });

  const practicePhase = mapTimerPhaseToMissionState(timer.phase);

  const displayPhase: LiveMissionPhase = isPractice
    ? practicePhase
    : isHost
      ? hostDisplayPhase
      : (joinerDisplay?.phase ?? mission?.state ?? 'waiting');

  const displayTimeLeftSec = isPractice
    ? timer.timeLeftSec
    : isHost
      ? hostTimeLeftSec
      : (joinerDisplay?.timeLeftSec ?? mission?.time_left_sec ?? setupDurationSec);

  const displayIsPaused = isPractice
    ? timer.phase === 'work' && timer.isPaused
    : isHost
      ? hostIsPaused
      : (joinerDisplay?.isPaused ?? mission?.is_paused ?? false);

  const displayWorkStartedAtMs =
    isPractice || isHost ? timer.workStartedAtMs : (joinerDisplay?.workStartedAtMs ?? null);

  // A joiner's clock is reconciled from the host's pushes and carries no pause
  // ledger, so it cannot spend wall time on round logging. Null says so.
  const displayPausedAccumMs = isPractice || isHost ? timer.pausedAccumMs : null;

  const displayElapsedSec = isPractice
    ? hostElapsedSec
    : isHost
      ? hostElapsedSec
      : joinerDisplay
        ? selectElapsedSecFromDisplay(joinerDisplay)
        : 0;

  const effectiveWorkDurationSec = isPractice ? timer.workDurationSec : workDurationSec;

  const workout = useMemo(() => mission?.workout ?? [], [mission?.workout]);
  const templateId = mission?.template_id ?? null;
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
        result.segment_index === segmentIndex &&
        result.score_breakdown !== null
    );
  }, [localPartialSubmitted, channel.segmentResults, participantId, segmentIndex]);

  const myRounds = useMemo(() => {
    return channel.rounds
      .filter(
        (round) => round.participant_id === participantId && round.segment_index === segmentIndex
      )
      .sort((a, b) => a.round_index - b.round_index);
  }, [channel.rounds, participantId, segmentIndex]);

  const myRoundCount = myRounds.length;

  /**
   * Every round boundary this athlete has logged, in mission-elapsed seconds.
   *
   * The first entry is round one's duration, which the pacing gauge takes as
   * its benchmark; the last is where the round in progress began.
   */
  const roundSplitsSec = useMemo(() => {
    return isPractice
      ? timer.rounds.map((round) => round.elapsedSecAtRound)
      : myRounds.map((round) => round.elapsed_sec_at_round);
  }, [isPractice, timer.rounds, myRounds]);

  /** Where the last logged round landed — the floor a correction interpolates from. */
  const lastLoggedElapsedSec = useMemo(() => {
    if (isPractice) {
      const last = timer.rounds[timer.rounds.length - 1];
      return last ? last.elapsedSecAtRound : 0;
    }
    const last = myRounds[myRounds.length - 1];
    return last ? last.elapsed_sec_at_round : 0;
  }, [isPractice, timer.rounds, myRounds]);

  const leaderboard = useMemo(
    () =>
      buildLeaderboard(
        channel.participants,
        channel.rounds,
        channel.segmentResults,
        segmentIndex,
        participantId,
        workout,
        mission?.duration_minutes ?? workDurationSec / 60,
        displayPhase
      ),
    [
      channel.participants,
      channel.rounds,
      channel.segmentResults,
      segmentIndex,
      participantId,
      workout,
      mission?.duration_minutes,
      workDurationSec,
      displayPhase,
    ]
  );

  const presence = useMemo(
    () => buildPresenceList(channel.participants, channel.presenceByParticipantId),
    [channel.participants, channel.presenceByParticipantId]
  );

  /**
   * Where this athlete stands on the board everyone else is looking at.
   * Ranked through the roster rather than off the leaderboard array, so the
   * number cannot disagree with the panel: only the roster knows about the
   * athletes who are here but have not scored.
   */
  const selfRank = useMemo(() => {
    const roster = buildParticipantRoster(
      leaderboard,
      presence,
      participantId ?? '',
      'absolute',
      displayPhase
    );
    return roster.find((entry) => entry.isSelf)?.rank ?? null;
  }, [leaderboard, presence, participantId, displayPhase]);

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
        'mission_abandoned',
        { time_left_sec: displayTimeLeftSec, round_count: myRoundCount },
        { missionId, participantId }
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
  }, [isPractice, displayPhase, displayTimeLeftSec, myRoundCount, missionId, participantId]);

  const start = useCallback(
    async (options?: { source?: MissionStartSource }) => {
      if (isPractice || !isHost || displayPhase !== 'waiting' || !mission) {
        return;
      }

      startSourceRef.current = options?.source ?? 'immediate';

      timer.start({
        setupDurationSec: setupDurationSec,
        workDurationSec: mission.duration_minutes * 60,
      });
    },
    [isPractice, isHost, displayPhase, mission, timer, setupDurationSec]
  );

  const startPractice = useCallback(() => {
    if (isPractice) {
      return;
    }
    const missionWaiting = (mission?.state ?? 'waiting') === 'waiting';
    if (!missionWaiting && displayPhase !== 'waiting') {
      return;
    }
    setIsPractice(true);
    timer.start({
      setupDurationSec,
      workDurationSec: PRACTICE_WORK_DURATION_SEC,
    });
    track('practice_started', {}, { missionId, participantId });
  }, [isPractice, mission?.state, displayPhase, timer, setupDurationSec, missionId, participantId]);

  const endPractice = useCallback(() => {
    if (!isPractice) {
      return;
    }
    track('practice_finished', { round_count: timer.rounds.length }, { missionId, participantId });
    setIsPractice(false);
    timer.reset();
  }, [isPractice, timer, missionId, participantId]);

  const resetMission = useCallback(async () => {
    if (isPractice) {
      if (timer.phase !== 'work' && timer.phase !== 'setup' && timer.phase !== 'finished') {
        return { missionId: null, error: null };
      }
      timer.reset();
      timer.start({
        setupDurationSec,
        workDurationSec: PRACTICE_WORK_DURATION_SEC,
      });
      setIsPractice(true);
      return { missionId: null, error: null };
    }

    if (!isHost) {
      return { missionId: null, error: 'Only the host can reset this mission.' };
    }

    const hostToken = getStoredHostToken(missionId);
    if (!hostToken) {
      return { missionId: null, error: 'Only the host can reset this mission.' };
    }

    const result = await resetLiveMission({ missionId, hostToken });
    if (result.error || !result.data) {
      const message = result.error?.message ?? 'Something went wrong. Please try again.';
      setSyncError(message);
      return { missionId: null, error: message };
    }

    persistMissionIdentity(result.data.missionId, {
      nickname: getStoredNickname(missionId) ?? nickname,
      participantId: result.data.participantId,
      hostToken: result.data.hostToken,
      claimToken: result.data.claimToken,
    });

    return { missionId: result.data.missionId, error: null };
  }, [isPractice, timer, setupDurationSec, isHost, missionId, nickname]);

  const pause = useCallback(async () => {
    if (timer.phase !== 'work' || timer.isPaused) {
      return;
    }
    if (!isPractice) {
      return;
    }
    timer.pause();
  }, [isPractice, timer]);

  const resume = useCallback(async () => {
    if (timer.phase !== 'work' || !timer.isPaused) {
      return;
    }
    if (!isPractice) {
      return;
    }
    timer.resume();
  }, [isPractice, timer]);

  const finish = useCallback(async () => {
    if (timer.phase !== 'work') {
      return;
    }
    if (!isPractice && !isHost) {
      return;
    }
    timer.finish();
  }, [isPractice, isHost, timer]);

  const elapsedSecNow = useCallback(
    () =>
      computeElapsedSecForLogRound({
        workDurationSec: effectiveWorkDurationSec,
        timeLeftSec: displayTimeLeftSec,
        phase: 'work',
        isPaused: displayIsPaused,
        workStartedAtMs: displayWorkStartedAtMs,
        pausedAccumMs: displayPausedAccumMs,
        nowMs: Date.now(),
      }),
    [
      effectiveWorkDurationSec,
      displayTimeLeftSec,
      displayIsPaused,
      displayWorkStartedAtMs,
      displayPausedAccumMs,
    ]
  );

  const previewMissedRound = useCallback(
    (repsIntoNextRound: number) =>
      computeMissedRoundElapsedSec({
        previousElapsedSec: lastLoggedElapsedSec,
        nowElapsedSec: elapsedSecNow(),
        repsPerRound,
        repsIntoNextRound,
      }),
    [lastLoggedElapsedSec, elapsedSecNow, repsPerRound]
  );

  const logMissedRoundAction = useCallback(
    async (repsIntoNextRound: number): Promise<boolean> => {
      if (displayPhase !== 'work' || displayIsPaused) {
        return false;
      }

      const estimate = computeMissedRoundElapsedSec({
        previousElapsedSec: lastLoggedElapsedSec,
        nowElapsedSec: elapsedSecNow(),
        repsPerRound,
        repsIntoNextRound,
      });

      if (isPractice) {
        timer.logRound({
          elapsedSecOverride: estimate.elapsedSecAtRound,
          missedLogReps: repsIntoNextRound,
        });
        return true;
      }

      if (!participantId) {
        return false;
      }

      const tokenForRpc = claimToken ?? '';
      if (!tokenForRpc && !isAuthenticated) {
        return false;
      }

      const result = await logRound({
        missionId,
        participantId,
        claimToken: tokenForRpc,
        roundIndex: myRoundCount,
        elapsedSecAtRound: estimate.elapsedSecAtRound,
        segmentIndex,
        missedLogReps: repsIntoNextRound,
      });

      if (result.error) {
        setSyncError(result.error.message);
        return false;
      }
      if (result.data?.ok === false && result.data.reason !== 'duplicate_round') {
        setSyncError(`Could not log the missed round: ${result.data.reason}`);
        return false;
      }
      return true;
    },
    [
      displayPhase,
      displayIsPaused,
      lastLoggedElapsedSec,
      elapsedSecNow,
      repsPerRound,
      isPractice,
      timer,
      participantId,
      claimToken,
      isAuthenticated,
      missionId,
      myRoundCount,
      segmentIndex,
    ]
  );

  const logRoundAction = useCallback(async (): Promise<boolean> => {
    if (displayPhase !== 'work' || displayIsPaused) {
      return false;
    }

    if (isPractice) {
      timer.logRound();
      return true;
    }

    if (!participantId) {
      return false;
    }

    const tokenForRpc = claimToken ?? '';
    if (!tokenForRpc && !isAuthenticated) {
      return false;
    }

    const elapsedSecAtRound = elapsedSecNow();

    const result = await logRound({
      missionId,
      participantId,
      claimToken: tokenForRpc,
      roundIndex: myRoundCount,
      elapsedSecAtRound,
      segmentIndex,
    });

    if (result.error) {
      setSyncError(result.error.message);
      return false;
    }
    if (result.data?.ok === false && result.data.reason !== 'duplicate_round') {
      setSyncError(`Could not log round: ${result.data.reason}`);
      return false;
    }
    // The server writing the round at an index we did not ask for means our
    // view of our own rounds is short -- an INSERT we never received. The round
    // is safe; the count on screen is not, and nothing else will correct it,
    // so pull a full snapshot.
    if (result.data?.ok === true && shouldResyncAfterLog(myRoundCount, result.data.roundIndex)) {
      channel.resync();
    }
    return true;
  }, [
    displayPhase,
    displayIsPaused,
    isPractice,
    timer,
    claimToken,
    isAuthenticated,
    participantId,
    elapsedSecNow,
    myRoundCount,
    missionId,
    segmentIndex,
    channel,
  ]);

  const submitPartialRepsAction = useCallback(
    async (
      partialReps: number,
      modifiedMovements: string[] = [],
      movementVariants: Record<string, string> = {},
      checkIn: {
        rpe: number | null;
        sessionNotes: string;
        checkIns: Record<string, string>;
      } = { rpe: null, sessionNotes: '', checkIns: {} }
    ): Promise<boolean> => {
      if (isPractice || !participantId || hasSubmittedPartialReps) {
        return false;
      }

      setSyncError(null);

      const tokenForRpc = claimToken ?? '';
      if (!tokenForRpc && !isAuthenticated) {
        setSyncError(
          'Cannot submit score without a mission credential. Rejoin the mission or sign in.'
        );
        return false;
      }

      const result = await submitParticipantResult({
        missionId,
        participantId,
        claimToken: tokenForRpc,
        partialReps,
        segmentIndex,
        modifiedMovements,
        movementVariants,
        rpe: checkIn.rpe,
        sessionNotes: checkIn.sessionNotes,
        checkIns: checkIn.checkIns,
      });

      if (result.data?.ok === false && result.data.reason === 'score_already_locked') {
        setSyncError(null);
        setLocalPartialSubmitted(true);
        return true;
      }

      if (result.error) {
        setSyncError(result.error.message);
        return false;
      }

      if (result.data?.ok === false) {
        setSyncError(`Could not submit partial reps: ${result.data.reason}`);
        return false;
      }

      setSyncError(null);
      setLocalPartialSubmitted(true);
      return true;
    },
    [
      isPractice,
      participantId,
      hasSubmittedPartialReps,
      claimToken,
      isAuthenticated,
      missionId,
      segmentIndex,
    ]
  );

  return {
    phase: displayPhase,
    timeLeftSec: displayTimeLeftSec,
    elapsedSec: displayElapsedSec,
    roundSplitsSec,
    isPaused: displayIsPaused,
    workDurationSec: effectiveWorkDurationSec,
    setupDurationSec,
    isHost,
    participantId,
    nickname,
    missionId,
    workout,
    templateId,
    participantCount,
    segmentIndex,
    scheduledAt: mission?.scheduled_at ?? null,
    rallyPointCountdownEndsAt: mission?.rally_point_countdown_ends_at ?? null,
    repsPerRound,
    hasSubmittedPartialReps: isPractice ? true : hasSubmittedPartialReps,
    leaderboard,
    presence,
    selfRank,
    isRealtimeConnected: channel.isConnected,
    lastAuthoritativeSyncAtMs,
    syncError,
    isPractice,
    practiceRounds: isPractice ? timer.rounds : [],
    start,
    startPractice,
    endPractice,
    resetMission,
    pause,
    resume,
    finish,
    logRound: logRoundAction,
    previewMissedRound,
    logMissedRound: logMissedRoundAction,
    canLogMissedRound: repsPerRound > 0,
    myRoundCount: isPractice ? timer.rounds.length : myRoundCount,
    submitPartialReps: submitPartialRepsAction,
  };
}
