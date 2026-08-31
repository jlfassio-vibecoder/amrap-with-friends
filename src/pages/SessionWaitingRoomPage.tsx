import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  getStoredParticipantId,
  getStoredClaimToken,
  getStoredNickname,
  getStoredGhostSelection,
  getStoredHostToken,
  persistSessionIdentity,
} from '@/lib/sessionIdentity';
import { useLiveAmrapSession } from '@/hooks/useLiveAmrapSession';
import { useParticipantClaim } from '@/hooks/useParticipantClaim';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useSessionChannel } from '@/lib/realtime/useSessionChannel';
import { canOfferSessionSave } from '@/lib/claim/canOfferSessionSave';
import { resumeSessionIdentity } from '@/lib/api/resumeSessionIdentity';
import { AppHeader } from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import { ExerciseInfoTrigger } from '@/components/exerciseInfo/ExerciseInfoTrigger';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { PartialRepsModal } from '@/components/PartialRepsModal';
import { SessionScorecard, type SessionScorecardSaveState } from '@/components/SessionScorecard';
import { SessionChat } from '@/components/SessionChat';
import { GhostPacerStrip } from '@/components/GhostPacerStrip';
import { CopyInviteLink } from '@/components/session/CopyInviteLink';
import { DaisyChainCta } from '@/components/session/DaisyChainCta';
import { MissionLoadingModal } from '@/components/session/MissionLoadingModal';
import { EditRallyScheduleForm } from '@/components/session/EditRallyScheduleForm';
import { ArmedRallyPointControls } from '@/components/session/ArmedRallyPointControls';
import { HostRallyPointSteps } from '@/components/session/HostRallyPointSteps';
import { SafetyNoticeModal } from '@/components/safety/SafetyNoticeModal';
import { useSessionSafetyNotices } from '@/components/safety/useSessionSafetyNotices';
import { CoachWalkthrough } from '@/components/walkthrough/CoachWalkthrough';
import { WalkthroughCompleteModal } from '@/components/walkthrough/WalkthroughCompleteModal';
import { useRallyPointWalkthrough } from '@/components/walkthrough/useRallyPointWalkthrough';
import { useGhostPacer } from '@/hooks/useGhostPacer';
import { useTacticalAudio } from '@/hooks/useTacticalAudio';
import { useRallyPointForceNav } from '@/hooks/useRallyPointForceNav';
import { useRallyPointHostHandoff } from '@/hooks/useRallyPointHostHandoff';
import { useStaleRallyPointHostClaim } from '@/hooks/useStaleRallyPointHostClaim';
import { useRallyPointChannel } from '@/lib/realtime/useRallyPointChannel';
import {
  announceNextMission,
  passRallyPointCommand,
  touchRallyPointPresence,
} from '@/lib/api/rallyPoint';
import { canPassRallyPointCommand } from '@/lib/rallyPoint/canPassRallyPointCommand';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import {
  getStoredRallyPointIdForSession,
  getStoredRallyPointMemberId,
  getStoredRallyPointNickname,
  setStoredRallyPointIdForSession,
} from '@/lib/rallyPointIdentity';
import type { StoredGhostSelection } from '@/lib/sessionIdentity';
import { clearStoredHostToken, setStoredHostToken } from '@/lib/sessionIdentity';
import {
  elapsedPastRallyPointCountdownSec,
  formatTMinus,
  remainingRallyPointCountdownSec,
} from '@/lib/session/rallyPointCountdown';

const RALLY_POINT_HEARTBEAT_MS = 15_000;

function formatTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'waiting':
      return 'Waiting';
    case 'setup':
      return 'Get ready';
    case 'work':
      return 'Live';
    case 'finished':
      return 'Finished';
    default:
      return phase;
  }
}

/** Types WAITING once, then cycles an ellipsis. Honors prefers-reduced-motion. */
function WaitingTypewriterLabel() {
  const WORD = 'WAITING';
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [chars, setChars] = useState(() => (prefersReducedMotion ? WORD.length : 0));
  const [dots, setDots] = useState(() => (prefersReducedMotion ? 3 : 0));

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    if (chars < WORD.length) {
      const id = window.setTimeout(() => setChars((count) => count + 1), 90);
      return () => window.clearTimeout(id);
    }

    const id = window.setInterval(() => {
      setDots((count) => (count + 1) % 4);
    }, 420);
    return () => window.clearInterval(id);
  }, [chars, prefersReducedMotion]);

  return (
    <p
      className="text-display text-xs uppercase tracking-widest text-secondary"
      aria-label="Waiting"
    >
      <span aria-hidden="true">
        {WORD.slice(0, chars)}
        {chars >= WORD.length ? (
          <span className="inline-block w-[1.65em] text-left">{'.'.repeat(dots)}</span>
        ) : null}
      </span>
    </p>
  );
}

function formatExerciseLabel(exercise: { name: string; target?: number; unit?: string }): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }

  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

type RestoredSessionIdentity = {
  sessionId: string;
  participantId: string;
  nickname: string;
  isHost: boolean;
};

type SyncIdentityBootstrap =
  | { kind: 'ready'; identity: RestoredSessionIdentity }
  | { kind: 'empty' }
  | { kind: 'need-resume'; storedParticipantId: string | null; storedNickname: string };

function readSyncIdentityBootstrap(
  sessionId: string,
  isAuthenticated: boolean
): SyncIdentityBootstrap {
  const storedParticipantId = getStoredParticipantId(sessionId);
  const storedHostToken = getStoredHostToken(sessionId);
  const storedNickname = getStoredNickname(sessionId) ?? 'Unknown';

  if (storedParticipantId && storedHostToken) {
    return {
      kind: 'ready',
      identity: {
        sessionId,
        participantId: storedParticipantId,
        nickname: storedNickname,
        isHost: true,
      },
    };
  }

  if (storedParticipantId && !isAuthenticated) {
    return {
      kind: 'ready',
      identity: {
        sessionId,
        participantId: storedParticipantId,
        nickname: storedNickname,
        isHost: false,
      },
    };
  }

  if (!isAuthenticated) {
    return { kind: 'empty' };
  }

  return {
    kind: 'need-resume',
    storedParticipantId,
    storedNickname,
  };
}

export default function SessionWaitingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();

  const syncBootstrap =
    sessionId && !isAuthLoading ? readSyncIdentityBootstrap(sessionId, isAuthenticated) : null;
  const needsResume = syncBootstrap?.kind === 'need-resume';
  const resumeKey = `${sessionId ?? ''}:${isAuthenticated}:${isAuthLoading}`;

  const [resumeState, setResumeState] = useState<{
    key: string;
    settled: boolean;
    identity: RestoredSessionIdentity | null;
    error: string | null;
  }>({ key: '', settled: false, identity: null, error: null });
  const [hostTokenSessionId, setHostTokenSessionId] = useState(sessionId ?? '');
  const [hostTokenPresent, setHostTokenPresent] = useState(() =>
    Boolean(sessionId && getStoredHostToken(sessionId))
  );

  // Adjust resume bookkeeping when the session/auth inputs change (render-time pattern).
  if (needsResume && resumeState.key !== resumeKey) {
    setResumeState({
      key: resumeKey,
      settled: false,
      identity: null,
      error: null,
    });
  } else if (!needsResume && resumeState.key !== resumeKey) {
    setResumeState({
      key: resumeKey,
      settled: true,
      identity: null,
      error: null,
    });
  }

  if ((sessionId ?? '') !== hostTokenSessionId) {
    setHostTokenSessionId(sessionId ?? '');
    setHostTokenPresent(Boolean(sessionId && getStoredHostToken(sessionId)));
  }

  useEffect(() => {
    if (!sessionId || !needsResume || isAuthLoading) {
      return;
    }

    let cancelled = false;
    const storedParticipantId = getStoredParticipantId(sessionId);
    const storedNickname = getStoredNickname(sessionId) ?? 'Unknown';

    void resumeSessionIdentity(sessionId).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        if (storedParticipantId) {
          setResumeState({
            key: resumeKey,
            settled: true,
            identity: {
              sessionId,
              participantId: storedParticipantId,
              nickname: storedNickname,
              isHost: Boolean(getStoredHostToken(sessionId)),
            },
            error: null,
          });
          return;
        }
        setResumeState({
          key: resumeKey,
          settled: true,
          identity: null,
          error: result.error.message,
        });
        return;
      }

      if (result.missing || !result.data) {
        if (storedParticipantId) {
          setResumeState({
            key: resumeKey,
            settled: true,
            identity: {
              sessionId,
              participantId: storedParticipantId,
              nickname: storedNickname,
              isHost: Boolean(getStoredHostToken(sessionId)),
            },
            error: null,
          });
          return;
        }
        setResumeState({
          key: resumeKey,
          settled: true,
          identity: null,
          error: 'No participant identity found for this session. Join or create again.',
        });
        return;
      }
      // Actually persist the resumed identity — without this, useLiveAmrapSession
      // (which reads getStoredHostToken() directly for real host RPC calls)
      // never sees the token this resume just fetched, even though the UI
      // above already re-keys itself into the host view.
      persistSessionIdentity(sessionId, {
        participantId: result.data.participantId,
        nickname: result.data.nickname,
        hostToken: result.data.hostToken ?? undefined,
      });

      setResumeState({
        key: resumeKey,
        settled: true,
        identity: {
          sessionId,
          participantId: result.data.participantId,
          nickname: result.data.nickname,
          isHost: Boolean(result.data.hostToken),
        },
        error: null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, needsResume, isAuthLoading, resumeKey]);

  const identityBootstrapDone =
    !isAuthLoading &&
    syncBootstrap !== null &&
    (syncBootstrap.kind !== 'need-resume' ||
      (resumeState.key === resumeKey && resumeState.settled));

  const activeRestored: RestoredSessionIdentity | null =
    syncBootstrap?.kind === 'ready'
      ? syncBootstrap.identity
      : resumeState.key === resumeKey
        ? resumeState.identity
        : null;
  const activeResumeError = resumeState.key === resumeKey ? resumeState.error : null;

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-error">Error: Missing session ID.</p>
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </main>
    );
  }

  if (isAuthLoading || !identityBootstrapDone) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-sm text-secondary">Restoring session identity…</p>
      </main>
    );
  }

  const participantId = activeRestored?.participantId ?? getStoredParticipantId(sessionId);
  const nickname = activeRestored?.nickname ?? getStoredNickname(sessionId) ?? 'Unknown';

  if (participantId) {
    return (
      <LiveSessionView
        key={`${sessionId}:${hostTokenPresent ? 'host' : 'joiner'}`}
        sessionId={sessionId}
        participantId={participantId}
        nickname={nickname}
        onHostAuthorityChange={() => setHostTokenPresent(Boolean(getStoredHostToken(sessionId)))}
      />
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <p className="text-error">
        Error:{' '}
        {activeResumeError ??
          'No participant identity found for this session. Join or create again.'}
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        {!isAuthenticated ? (
          <Link className="link-accent" to="/join">
            Join session
          </Link>
        ) : null}
        <Link className="link-accent" to="/my-sessions">
          My sessions
        </Link>
        <Link className="link-accent" to="/create">
          Create session
        </Link>
      </div>
    </main>
  );
}

function LiveSessionView({
  sessionId,
  participantId,
  nickname,
  onHostAuthorityChange,
}: {
  sessionId: string;
  participantId: string;
  nickname: string;
  onHostAuthorityChange?: () => void;
}) {
  const navigate = useNavigate();
  const claimToken = getStoredClaimToken(sessionId);
  const { isAuthenticated, isAuthLoading, user } = useAmrapAuth();
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [forceNavError, setForceNavError] = useState<string | null>(null);
  const [daisyExitError, setDaisyExitError] = useState<string | null>(null);
  const [isSubmittingPartialReps, setIsSubmittingPartialReps] = useState(false);
  const [scorecardDismissed, setScorecardDismissed] = useState(false);
  const [missionLoadingDismissed, setMissionLoadingDismissed] = useState(false);
  const [authOpenForSave, setAuthOpenForSave] = useState(false);
  const pendingSaveAfterAuth = useRef(false);
  const [ghostSelection, setGhostSelection] = useState<StoredGhostSelection | null>(() =>
    getStoredGhostSelection(sessionId)
  );
  // Copilot suggestion ignored: activeGhostSelection already gates stored selection on isAuthenticated.
  const activeGhostSelection = isAuthenticated ? ghostSelection : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const audioUnlockedRef = useRef(false);
  const {
    activeNotice: activeSafetyNotice,
    safetyNoticesComplete,
    confirmSafetyNotice,
  } = useSessionSafetyNotices(sessionId);

  const channel = useSessionChannel(sessionId, { participantId, nickname });
  const live = useLiveAmrapSession(sessionId, channel);
  const { isHost, start: startSession, phase: livePhase } = live;

  const rallyPointId =
    channel.session?.rally_point_id ?? getStoredRallyPointIdForSession(sessionId) ?? null;

  useEffect(() => {
    if (channel.session?.rally_point_id) {
      setStoredRallyPointIdForSession(sessionId, channel.session.rally_point_id);
    }
  }, [channel.session?.rally_point_id, sessionId]);

  const rallyPointMemberId = rallyPointId ? getStoredRallyPointMemberId(rallyPointId) : null;
  const rallyPointNickname =
    (rallyPointId ? getStoredRallyPointNickname(rallyPointId) : null) ?? nickname;
  const rallyPointChannelPresence =
    rallyPointId && rallyPointMemberId && rallyPointNickname
      ? { memberId: rallyPointMemberId, nickname: rallyPointNickname }
      : null;
  const rallyPointChannel = useRallyPointChannel(
    rallyPointId && (livePhase === 'waiting' || livePhase === 'setup' || livePhase === 'finished')
      ? rallyPointId
      : undefined,
    rallyPointChannelPresence,
    { realtimeTables: isAuthenticated }
  );

  useRallyPointHostHandoff({
    hostUserId: rallyPointChannel.rallyPoint?.hostUserId,
    activeSessionId: rallyPointChannel.rallyPoint?.activeSessionId ?? sessionId,
    userId: user?.id,
    enabled: Boolean(rallyPointId) && (livePhase === 'waiting' || livePhase === 'setup'),
    onHostAuthorityChange,
  });

  const waitingOrSetup = livePhase === 'waiting' || livePhase === 'setup';

  useEffect(() => {
    if (!rallyPointId || !isAuthenticated || !waitingOrSetup) {
      return;
    }
    void touchRallyPointPresence(rallyPointId);
    const id = window.setInterval(() => {
      void touchRallyPointPresence(rallyPointId);
    }, RALLY_POINT_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [rallyPointId, isAuthenticated, waitingOrSetup]);

  const waitingHostMemberId =
    rallyPointChannel.rallyPoint?.members.find(
      (member) =>
        Boolean(rallyPointChannel.rallyPoint?.hostUserId) &&
        member.userId === rallyPointChannel.rallyPoint?.hostUserId
    )?.id ?? null;

  useStaleRallyPointHostClaim({
    rallyPointId,
    hostUserId: rallyPointChannel.rallyPoint?.hostUserId,
    userId: user?.id,
    hostMemberId: waitingHostMemberId,
    presenceByMemberId: rallyPointChannel.presenceByMemberId,
    enabled: Boolean(rallyPointId && waitingOrSetup && user?.id),
    onClaimed: (result) => {
      if (result.hostToken && result.activeSessionId) {
        setStoredHostToken(result.activeSessionId, result.hostToken);
      }
      onHostAuthorityChange?.();
      void rallyPointChannel.refresh();
    },
  });

  const walkthrough = useRallyPointWalkthrough({
    sessionId,
    isHost,
    enabled: safetyNoticesComplete && livePhase === 'waiting',
  });
  const sessionReady = safetyNoticesComplete && walkthrough.complete;
  const { unlock: unlockAudio, playRoundLogged } = useTacticalAudio({
    phase: live.phase,
    timeLeftSec: live.timeLeftSec,
    isPaused: live.isPaused,
    workDurationSec: live.workDurationSec,
  });
  const claim = useParticipantClaim(sessionId);
  const selfLeaderboardEntry = live.leaderboard.find((entry) => entry.isSelf) ?? null;
  const selfBaseScore = selfLeaderboardEntry?.baseScore ?? 0;

  const rallyPointCountdownEndsAt = live.rallyPointCountdownEndsAt;
  const rallyPointRemaining = remainingRallyPointCountdownSec(rallyPointCountdownEndsAt, nowMs);
  const rallyPointCountdownArmed = livePhase === 'waiting' && rallyPointCountdownEndsAt !== null;
  const rallyPointTicking =
    rallyPointCountdownArmed && rallyPointRemaining !== null && rallyPointRemaining > 0;
  const rallyPointIgnited = rallyPointCountdownArmed && rallyPointRemaining === 0;
  const rallyPointOvertimeSec = rallyPointIgnited
    ? elapsedPastRallyPointCountdownSec(rallyPointCountdownEndsAt, nowMs)
    : null;

  useEffect(() => {
    if (!rallyPointCountdownArmed) {
      return;
    }
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [rallyPointCountdownArmed]);

  const ghostPacer = useGhostPacer({
    sessionId,
    ghostSelection: activeGhostSelection,
    repsPerRound: live.repsPerRound,
    workDurationSec: live.workDurationSec,
    elapsedSec: live.elapsedSec,
    selfBaseScore,
  });

  const isSoloTemplated =
    live.participantCount === 1 && live.templateId !== null && livePhase === 'waiting';
  const showGhostPicker = isSoloTemplated;
  // Copilot suggestion ignored: ghost pacer error display and strip suppression on load failure already exist.
  const showGhostPacerError =
    activeGhostSelection !== null && livePhase === 'work' && ghostPacer.error !== null;
  const showGhostPacerStrip =
    activeGhostSelection !== null &&
    livePhase === 'work' &&
    ghostPacer.error === null &&
    !ghostPacer.isLoading;

  // Copilot suggestion ignored: Start/Abort while armed live in ArmedRallyPointControls; changing showStart would duplicate host Start while ticking.
  const showStart =
    isHost &&
    livePhase === 'waiting' &&
    !rallyPointCountdownArmed &&
    !live.isPractice &&
    safetyNoticesComplete;
  const showPractice =
    livePhase === 'waiting' &&
    !rallyPointCountdownArmed &&
    !live.isPractice &&
    safetyNoticesComplete;
  const showSafetyNotice = livePhase === 'waiting' && activeSafetyNotice !== null;
  const showWalkthrough = walkthrough.active;
  const showWalkthroughFinale = walkthrough.showingFinale;
  const waitingStartPracticeActions =
    showStart || showPractice ? (
      <div className="flex flex-wrap items-center gap-2" data-walkthrough-id="actions">
        {showStart ? (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={!sessionReady}
            onClick={() => {
              handleAudioUnlock();
              void startSession();
            }}
          >
            Start
          </button>
        ) : null}
        {showPractice ? (
          <button
            type="button"
            className="btn-outline px-3 py-1.5 text-sm"
            disabled={!sessionReady}
            onClick={() => {
              handleAudioUnlock();
              live.startPractice();
            }}
          >
            Practice
          </button>
        ) : null}
      </div>
    ) : null;
  const showPause = livePhase === 'work' && !live.isPaused && (isHost || live.isPractice);
  const showResume = livePhase === 'work' && live.isPaused && (isHost || live.isPractice);
  const showLogRound = livePhase === 'work' && !live.isPaused;
  const showEndPractice = live.isPractice && livePhase === 'finished';
  const showPartialRepsModal =
    !live.isPractice &&
    livePhase === 'finished' &&
    live.repsPerRound > 0 &&
    !live.hasSubmittedPartialReps;
  const showScorecard =
    !live.isPractice &&
    livePhase === 'finished' &&
    live.hasSubmittedPartialReps &&
    !scorecardDismissed &&
    selfLeaderboardEntry !== null;
  const showFinishedClaimPrompt =
    !live.isPractice &&
    livePhase === 'finished' &&
    claim.showClaimPrompt &&
    !showPartialRepsModal &&
    !showScorecard;

  const forceNav = useRallyPointForceNav({
    rallyPointId,
    activeSessionId: rallyPointChannel.rallyPoint?.activeSessionId,
    activeSessionState: rallyPointChannel.rallyPoint?.activeSessionState,
    currentSessionId: sessionId,
    // Hold straggler pull until AAR is dismissed — Daisy-chain / Close are the exits.
    enabled: livePhase === 'finished' && !showPartialRepsModal && !showScorecard,
    onError: setForceNavError,
  });

  async function handlePassCommand(toUserId: string) {
    if (!rallyPointId) {
      return;
    }
    setPassError(null);
    setPassBusy(true);
    try {
      const result = await passRallyPointCommand({ rallyPointId, toUserId });
      if (result.error) {
        setPassError(result.error.message);
        return;
      }
      clearStoredHostToken(sessionId);
      onHostAuthorityChange?.();
    } finally {
      setPassBusy(false);
    }
  }

  const showRallyPointPass =
    isHost &&
    Boolean(rallyPointId) &&
    (livePhase === 'waiting' || livePhase === 'setup') &&
    Boolean(rallyPointChannel.rallyPoint?.members.length);

  const rallyPointHref = rallyPointId ? `/rally-point/${rallyPointId}` : null;
  const nextMissionPendingAt = rallyPointChannel.rallyPoint?.nextMissionPendingAt ?? null;
  const missionLoadingStorageKey =
    rallyPointId && nextMissionPendingAt
      ? `mission-loading:${rallyPointId}:${nextMissionPendingAt}`
      : null;

  useEffect(() => {
    if (!missionLoadingStorageKey) {
      setMissionLoadingDismissed(false);
      return;
    }
    try {
      setMissionLoadingDismissed(sessionStorage.getItem(missionLoadingStorageKey) === '1');
    } catch {
      setMissionLoadingDismissed(false);
    }
  }, [missionLoadingStorageKey]);

  const showMissionLoadingModal =
    livePhase === 'finished' && Boolean(nextMissionPendingAt) && !missionLoadingDismissed;

  async function handleDaisyChainExit() {
    if (!rallyPointHref) {
      navigate('/');
      return;
    }
    setDaisyExitError(null);
    if (isHost && rallyPointId) {
      const result = await announceNextMission(rallyPointId);
      if (result.error) {
        setDaisyExitError(result.error.message);
        return;
      }
    }
    navigate(rallyPointHref);
  }

  function dismissMissionLoading() {
    if (missionLoadingStorageKey) {
      try {
        sessionStorage.setItem(missionLoadingStorageKey, '1');
      } catch {
        /* sessionStorage unavailable */
      }
    }
    setMissionLoadingDismissed(true);
  }

  const canSave = canOfferSessionSave({
    claimToken,
    participantId,
    claimStatus: claim.claimStatus,
  });

  const scorecardSaveState: SessionScorecardSaveState =
    claim.claimStatus === 'claimed'
      ? 'saved'
      : claim.isClaiming
        ? 'saving'
        : canSave
          ? 'idle'
          : 'unavailable';

  const handleScorecardSave = () => {
    if (!isAuthenticated) {
      pendingSaveAfterAuth.current = true;
      setAuthOpenForSave(true);
      return;
    }

    void claim.saveToAccount();
  };

  useEffect(() => {
    if (
      isAuthLoading ||
      !pendingSaveAfterAuth.current ||
      !isAuthenticated ||
      !canSave ||
      claim.isClaiming
    ) {
      return;
    }

    pendingSaveAfterAuth.current = false;
    void claim.saveToAccount();
  }, [isAuthLoading, isAuthenticated, canSave, claim]);

  const handleAuthCloseForSave = () => {
    setAuthOpenForSave(false);
    if (!isAuthenticated) {
      pendingSaveAfterAuth.current = false;
    }
  };

  const handleSubmitPartialReps = async (partialReps: number) => {
    setIsSubmittingPartialReps(true);
    try {
      await live.submitPartialReps(partialReps);
    } finally {
      setIsSubmittingPartialReps(false);
    }
  };

  function handleAudioUnlock() {
    audioUnlockedRef.current = true;
    unlockAudio();
  }

  const hostStatusText = live.isPractice
    ? 'Practice — 2 min, not recorded.'
    : isHost
      ? 'You are the host.'
      : 'Waiting on host for session control.';

  return (
    <main
      className="mx-auto max-w-lg space-y-6 bg-page px-6 pb-6 pt-0 lg:flex lg:h-dvh lg:max-w-none lg:flex-col lg:space-y-0 lg:overflow-hidden lg:p-0"
      onPointerDown={() => {
        if (audioUnlockedRef.current) {
          return;
        }
        handleAudioUnlock();
      }}
    >
      <div
        className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        inert={
          showPartialRepsModal ||
          showSafetyNotice ||
          showWalkthrough ||
          showWalkthroughFinale ||
          undefined
        }
      >
        <AppHeader title="Rally point" subtitle={hostStatusText} desktopTitleAsPageHeading />

        <div className="space-y-6 px-6 pb-6 pt-0 lg:mx-auto lg:w-full lg:max-w-7xl lg:shrink-0 lg:space-y-4 lg:px-8 lg:pb-0 lg:pt-6">
          {forceNav.pendingSessionId ? (
            <div
              className="border-accent/40 flex flex-wrap items-center justify-between gap-3 border bg-surface px-4 py-3"
              role="status"
            >
              <p className="text-sm text-ink">
                Next session starting
                {forceNav.secondsLeft > 0 ? ` in ${forceNav.secondsLeft}s` : ''} —{' '}
                <button
                  type="button"
                  className="link-accent font-semibold"
                  onClick={() => forceNav.joinNow()}
                >
                  Join now
                </button>
              </p>
            </div>
          ) : null}

          {live.syncError && <p className="alert-error">{live.syncError}</p>}

          {claim.claimError && <p className="alert-error">{claim.claimError}</p>}

          {claim.claimMessage && <p className="alert-success">{claim.claimMessage}</p>}

          {showFinishedClaimPrompt && (
            <section className="card space-y-2 bg-accent-tint p-4 text-sm">
              <p className="font-semibold">Save your results</p>
              <p className="text-secondary">
                Sign up is optional, but saving links this session to your account for My Sessions.
              </p>
              {/* Copilot suggestion ignored: this banner only renders when claim.showClaimPrompt requires isAuthenticated. */}
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={claim.isClaiming}
                onClick={() => claim.saveToAccount()}
              >
                {claim.isClaiming ? 'Saving…' : 'Save this session to my account'}
              </button>
            </section>
          )}

          {claim.showClaimPrompt && live.phase !== 'finished' && (
            <section className="card p-4 text-sm">
              {/* Copilot suggestion ignored: mid-session save CTA is also gated by authenticated claim.showClaimPrompt. */}
              <button
                type="button"
                className="btn-outline"
                disabled={claim.isClaiming}
                onClick={() => claim.saveToAccount()}
              >
                {claim.isClaiming ? 'Saving…' : 'Save this session to my account'}
              </button>
            </section>
          )}
        </div>

        <div className="space-y-6 px-6 lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-7xl lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 lg:overflow-hidden lg:px-8 lg:py-6">
          <div className="space-y-6 lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden">
            <div className="space-y-4 lg:flex lg:min-h-0 lg:shrink lg:flex-col lg:gap-3 lg:space-y-0 lg:overflow-y-auto lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-4 lg:shadow-card">
              <section
                className="card space-y-1.5 p-3 text-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
                data-walkthrough-id="status"
              >
                {live.phase === 'waiting' ? (
                  <WaitingTypewriterLabel />
                ) : (
                  <p className="text-display text-xs uppercase tracking-widest text-secondary">
                    {phaseLabel(live.phase)}
                  </p>
                )}
                {live.phase === 'waiting' && (rallyPointTicking || rallyPointIgnited) ? (
                  <p className="font-mono text-3xl tabular-nums tracking-widest text-accent lg:text-5xl">
                    {formatTMinus(rallyPointRemaining ?? 0)}
                  </p>
                ) : live.phase !== 'waiting' ? (
                  <p className="text-display text-5xl tabular-nums text-accent lg:text-7xl xl:text-8xl">
                    {formatTime(live.timeLeftSec)}
                  </p>
                ) : null}
                {isHost && rallyPointCountdownArmed ? (
                  <div className="flex justify-center pt-1">
                    <ArmedRallyPointControls
                      sessionId={sessionId}
                      ticking={rallyPointTicking}
                      overtimeSec={rallyPointOvertimeSec}
                      actionsEnabled={sessionReady}
                      onAudioUnlock={handleAudioUnlock}
                      onStart={() => {
                        handleAudioUnlock();
                        void startSession();
                      }}
                    />
                  </div>
                ) : null}
                {live.phase === 'work' || live.phase === 'finished' ? (
                  <p className="text-sm text-secondary">Elapsed: {formatTime(live.elapsedSec)}</p>
                ) : null}
                <p className="text-xs text-muted">
                  Realtime:{' '}
                  {live.isRealtimeConnected ? (
                    <span className="font-semibold text-success-text [text-shadow:0_0_8px_rgb(90_158_82_/_0.95),0_0_18px_rgb(90_158_82_/_0.55)]">
                      connected
                    </span>
                  ) : (
                    <span>connecting…</span>
                  )}
                </p>
              </section>

              {live.phase === 'waiting' && live.scheduledAt ? (
                isHost ? (
                  <EditRallyScheduleForm
                    key={live.scheduledAt}
                    sessionId={sessionId}
                    scheduledAt={live.scheduledAt}
                    dayActions={waitingStartPracticeActions}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-secondary">
                      Rally time:{' '}
                      {new Date(live.scheduledAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {waitingStartPracticeActions ? (
                      <div className="flex justify-center">{waitingStartPracticeActions}</div>
                    ) : null}
                  </div>
                )
              ) : live.phase === 'waiting' && waitingStartPracticeActions ? (
                <div className="flex justify-center">{waitingStartPracticeActions}</div>
              ) : null}

              {isHost && live.phase === 'waiting' ? (
                <HostRallyPointSteps
                  sessionId={sessionId}
                  rallyPointId={rallyPointId}
                  countdownArmed={rallyPointCountdownArmed}
                  actionsEnabled={sessionReady}
                  onAudioUnlock={handleAudioUnlock}
                  showPacer={showGhostPicker}
                  templateId={live.templateId}
                  durationMinutes={live.workDurationSec / 60}
                  ghostSelection={ghostSelection}
                  onGhostChange={setGhostSelection}
                />
              ) : null}

              {!isHost && live.phase === 'waiting' ? (
                <CopyInviteLink sessionId={sessionId} rallyPointId={rallyPointId} />
              ) : null}

              {showGhostPacerError && activeGhostSelection ? (
                <p className="alert-error text-sm">{ghostPacer.error}</p>
              ) : null}

              {showGhostPacerStrip && activeGhostSelection ? (
                <GhostPacerStrip
                  ghostLabel={activeGhostSelection.label}
                  ghostReps={ghostPacer.ghostReps}
                  selfReps={ghostPacer.selfReps}
                  deltaReps={ghostPacer.deltaReps}
                />
              ) : null}

              <section
                className="flex flex-wrap gap-2 lg:justify-center"
                {...(waitingStartPracticeActions ? {} : { 'data-walkthrough-id': 'actions' })}
              >
                {showPause && (
                  <button
                    type="button"
                    className="btn-outline px-3 py-1.5 text-sm lg:px-6 lg:py-3 lg:text-base"
                    onClick={() => {
                      handleAudioUnlock();
                      void live.pause();
                    }}
                  >
                    Pause
                  </button>
                )}
                {showResume && (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-sm lg:px-6 lg:py-3 lg:text-base"
                    onClick={() => {
                      handleAudioUnlock();
                      void live.resume();
                    }}
                  >
                    Resume
                  </button>
                )}
                {showLogRound && (
                  <button
                    type="button"
                    className="btn-success px-3 py-1.5 text-sm lg:px-6 lg:py-3 lg:text-base"
                    onClick={() => {
                      playRoundLogged();
                      void live.logRound();
                    }}
                  >
                    Log round
                  </button>
                )}
                {showEndPractice && (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-sm"
                    onClick={() => live.endPractice()}
                  >
                    End practice
                  </button>
                )}
              </section>

              {live.isPractice && live.practiceRounds.length > 0 ? (
                <section className="rounded-card border border-border bg-page p-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Practice splits
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-ink">
                    {live.practiceRounds.map((round) => (
                      <li key={round.roundIndex}>
                        Round {round.roundIndex + 1}: {round.elapsedSecAtRound}s
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            {live.workout.length > 0 && (
              <section className="card shrink-0 space-y-2 p-4" data-walkthrough-id="workout">
                <h2 className="text-display text-center text-xl text-ink lg:text-3xl">
                  {resolveWorkoutTitle(live.templateId)}
                </h2>
                <ul className="space-y-1 text-sm lg:space-y-4">
                  {live.workout.map((exercise, index) => (
                    <li
                      key={`${exercise.name}-${index}`}
                      className="flex items-center gap-2 lg:gap-4"
                    >
                      <span className="hidden lg:flex lg:h-12 lg:w-12 lg:shrink-0 lg:items-center lg:justify-center lg:rounded-full lg:bg-accent lg:text-xl lg:font-semibold lg:text-on-accent">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 lg:text-2xl lg:leading-snug xl:text-3xl">
                        {formatExerciseLabel(exercise)}
                      </span>
                      <ExerciseInfoTrigger name={exercise.name} size="lg" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <SessionChat
              sessionId={sessionId}
              participantId={participantId}
              claimToken={claimToken}
              isAuthenticated={isAuthenticated}
              messages={channel.messages}
              className="min-h-[12rem] flex-1 overflow-hidden"
            />
          </div>

          <div className="flex min-h-0 flex-col gap-6 lg:overflow-hidden">
            <ParticipantsPanel
              leaderboard={live.leaderboard}
              presence={live.presence}
              selfParticipantId={live.participantId}
              phase={live.phase}
              className={
                showRallyPointPass && rallyPointChannel.rallyPoint
                  ? 'lg:min-h-0 lg:flex-[2] lg:overflow-hidden'
                  : 'lg:min-h-0 lg:flex-1 lg:overflow-hidden'
              }
            />

            {showRallyPointPass && rallyPointChannel.rallyPoint ? (
              <section className="card flex min-h-0 flex-col space-y-3 overflow-hidden p-4 lg:flex-1 lg:overflow-y-auto">
                <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-secondary">
                  Pass Command
                </h2>
                <ul className="min-h-0 space-y-2 overflow-y-auto">
                  {rallyPointChannel.rallyPoint.members.map((member) => {
                    const canPass = canPassRallyPointCommand(member, user?.id);
                    const isMemberHost = Boolean(
                      rallyPointChannel.rallyPoint?.hostUserId &&
                      member.userId === rallyPointChannel.rallyPoint.hostUserId
                    );
                    if (!canPass && !isMemberHost) {
                      return null;
                    }
                    return (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-divider py-2 last:border-0"
                      >
                        <div>
                          <span className="text-ink">{member.nickname}</span>
                          {isMemberHost ? (
                            <span className="ml-2 text-xs uppercase tracking-widest text-accent">
                              Host
                            </span>
                          ) : null}
                        </div>
                        {canPass ? (
                          <button
                            type="button"
                            className="text-xs uppercase tracking-widest text-muted hover:text-ink"
                            disabled={passBusy || !member.userId}
                            onClick={() => member.userId && void handlePassCommand(member.userId)}
                          >
                            Pass Command
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {passError ? <p className="text-error shrink-0 text-sm">{passError}</p> : null}
              </section>
            ) : null}
          </div>
        </div>

        <section className="space-y-2 px-6 pb-6 text-sm text-secondary lg:hidden">
          <p>
            <span className="font-semibold text-ink">Session ID:</span> {live.sessionId}
          </p>
          <p>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </p>
          {daisyExitError ? <p className="text-error text-sm">{daisyExitError}</p> : null}
          {forceNavError ? <p className="text-error text-sm">{forceNavError}</p> : null}
          <div className="flex flex-wrap gap-4">
            {rallyPointHref ? (
              <DaisyChainCta className="link-accent text-sm" onActivate={handleDaisyChainExit} />
            ) : (
              <Link className="link-accent" to="/">
                Back home
              </Link>
            )}
            {rallyPointHref ? (
              <Link className="link-accent" to="/">
                Back home
              </Link>
            ) : null}
          </div>
        </section>

        <footer className="hidden border-t border-divider bg-surface text-sm text-secondary lg:flex lg:shrink-0 lg:items-center lg:justify-between lg:gap-4 lg:px-8 lg:py-3">
          <span>
            <span className="font-semibold text-ink">Session ID:</span> {live.sessionId}
          </span>
          <span>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </span>
          <span className="flex flex-wrap items-center gap-4">
            {daisyExitError ? <span className="text-error text-sm">{daisyExitError}</span> : null}
            {forceNavError ? <span className="text-error text-sm">{forceNavError}</span> : null}
            {rallyPointHref ? (
              <DaisyChainCta className="link-accent text-sm" onActivate={handleDaisyChainExit} />
            ) : (
              <Link className="link-accent" to="/">
                Back home
              </Link>
            )}
            {rallyPointHref ? (
              <Link className="link-accent" to="/">
                Back home
              </Link>
            ) : null}
          </span>
        </footer>
      </div>

      {showPartialRepsModal ? (
        <PartialRepsModal
          repsPerRound={live.repsPerRound}
          isSubmitting={isSubmittingPartialReps}
          onSubmit={handleSubmitPartialReps}
        />
      ) : null}

      {showScorecard && selfLeaderboardEntry ? (
        <SessionScorecard
          entry={selfLeaderboardEntry}
          durationMinutes={live.workDurationSec / 60}
          saveState={scorecardSaveState}
          onSave={handleScorecardSave}
          saveError={claim.claimError}
          saveMessage={claim.claimMessage}
          onClose={() => setScorecardDismissed(true)}
          rallyPointHref={rallyPointHref}
          rallyPointId={rallyPointId}
          isHost={isHost}
        />
      ) : null}

      {showMissionLoadingModal ? <MissionLoadingModal onConfirm={dismissMissionLoading} /> : null}

      {authOpenForSave ? <AuthModal onClose={handleAuthCloseForSave} /> : null}

      {showSafetyNotice && activeSafetyNotice ? (
        <SafetyNoticeModal
          title={activeSafetyNotice.title}
          body={activeSafetyNotice.body}
          onConfirm={confirmSafetyNotice}
        />
      ) : null}

      {showWalkthrough && walkthrough.activeStep ? (
        <CoachWalkthrough
          step={walkthrough.activeStep}
          onNext={walkthrough.next}
          onSkip={walkthrough.skipVisit}
        />
      ) : null}

      {showWalkthroughFinale ? (
        <WalkthroughCompleteModal
          onContinue={walkthrough.confirmLetsDoThis}
          onNeverShowAgain={walkthrough.dismissForever}
        />
      ) : null}
    </main>
  );
}
