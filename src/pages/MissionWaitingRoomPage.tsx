import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getStoredParticipantId,
  getStoredClaimToken,
  getStoredNickname,
  getStoredGhostSelection,
  getStoredHostToken,
  clearStoredHostToken,
  setStoredHostToken,
  persistMissionIdentity,
} from '@/lib/missionIdentity';
import { useLiveAmrapMission } from '@/hooks/useLiveAmrapMission';
import { track, trackBeacon } from '@/lib/analytics/track';
import {
  isWaitingRoomPresenceState,
  rallyPointStayDurationSec,
  resolveMissionStartSource,
  type RallyPointLeaveReason,
} from '@/lib/analytics/missionStartSource';
import { useParticipantClaim } from '@/hooks/useParticipantClaim';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useMissionChannel } from '@/lib/realtime/useMissionChannel';
import { canOfferMissionSave } from '@/lib/claim/canOfferMissionSave';
import { RoomFinishSheet } from '@/components/mission/RoomFinishSheet';
import { resumeMissionIdentity } from '@/lib/api/resumeMissionIdentity';
import { AppHeader } from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import { ExerciseInfoTrigger } from '@/components/exerciseInfo/ExerciseInfoTrigger';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { PartialRepsModal } from '@/components/PartialRepsModal';
import { MissionScorecard, type MissionScorecardSaveState } from '@/components/MissionScorecard';
import { MissionChat } from '@/components/MissionChat';
import { GhostPacerStrip } from '@/components/GhostPacerStrip';
import { CopyInviteLink } from '@/components/mission/CopyInviteLink';
import { DaisyChainCta } from '@/components/mission/DaisyChainCta';
import { MissionLoadingModal } from '@/components/mission/MissionLoadingModal';
import { MissionLockedModal } from '@/components/mission/MissionLockedModal';
import { EditRallyScheduleForm } from '@/components/mission/EditRallyScheduleForm';
import { ArmedRallyPointControls } from '@/components/mission/ArmedRallyPointControls';
import { HostRallyPointSteps } from '@/components/mission/HostRallyPointSteps';
import { LogMissedRound } from '@/components/mission/LogMissedRound';
import { MissionAmqapGauge } from '@/components/mission/MissionAmqapGauge';
import { MissionPacingGauge } from '@/components/mission/MissionPacingGauge';
import { findAmqapFlow } from '@/data/amqapFlows';
import {
  elapsedInRoundSec,
  formatAmqapActiveExerciseDetail,
  setProgressFromRoundElapsed,
} from '@/lib/amqap/amqapSetGauge';
import { expandAmqapSets } from '@/lib/amqap/expandAmqapSets';
import { shouldAutoLockAmqapScore } from '@/lib/amqap/shouldAutoLockAmqapScore';
import { PreMissionScalingPicker } from '@/components/mission/PreMissionScalingPicker';
import { BenchmarkDesignateControl } from '@/components/mission/BenchmarkDesignateControl';
import { RoundLogRippleBurst } from '@/components/mission/RoundLogRippleBurst';
import { GhostPicker } from '@/components/GhostPicker';
import { SafetyNoticeModal } from '@/components/safety/SafetyNoticeModal';
import { useMissionSafetyNotices } from '@/components/safety/useMissionSafetyNotices';
import { CoachWalkthrough } from '@/components/walkthrough/CoachWalkthrough';
import { WalkthroughCompleteModal } from '@/components/walkthrough/WalkthroughCompleteModal';
import { useRallyPointWalkthrough } from '@/components/walkthrough/useRallyPointWalkthrough';
import { useGhostPacer } from '@/hooks/useGhostPacer';
import { useMissionLockedModal } from '@/hooks/useMissionLockedModal';
import { useRoundLogPulse } from '@/hooks/useRoundLogPulse';
import { useTacticalAudio } from '@/hooks/useTacticalAudio';
import { useRallyPointForceNav } from '@/hooks/useRallyPointForceNav';
import {
  shouldAdvanceMissionChain,
  shouldPullViewerToActiveMission,
} from '@/lib/mission/missionChainNavigation';
import { useRallyPointHostHandoff } from '@/hooks/useRallyPointHostHandoff';
import { useStaleRallyPointHostClaim } from '@/hooks/useStaleRallyPointHostClaim';
import { useRallyPointChannel } from '@/lib/realtime/useRallyPointChannel';
import {
  announceNextMission,
  getRallyPoint,
  isLiveRallyPointMissionState,
  joinRallyPoint,
  passRallyPointCommand,
  touchRallyPointPresence,
} from '@/lib/api/rallyPoint';
import { getMissionChain, startNextChainedMission } from '@/lib/api/missionChain';
import {
  chainHasUnstartedItems,
  chainPlanSummaryForMission,
  chainRestBannerForMission,
} from '@/lib/mission/chainAdvanceCopy';
import { nextChainedMissionName } from '@/lib/mission/nextChainedMissionName';
import { formatMissionStateLabel } from '@/lib/mission/formatMissionStateLabel';
import { canPassRallyPointCommand } from '@/lib/rallyPoint/canPassRallyPointCommand';
import { shouldHandleLogRoundHotkey } from '@/lib/mission/logRoundHotkey';
import { LOG_ROUND_COOLDOWN_ALERT, canLogRound } from '@/lib/mission/logRoundCooldown';
import {
  hideMobileLiveChrome,
  formatMobileLiveScoreLabel,
  shouldDenseMobileLiveWorkout,
  shouldOmitMobileLiveHowTo,
} from '@/lib/mission/mobileLiveLayout';
import { shouldShowMissionReset } from '@/lib/mission/shouldShowMissionReset';
import { shouldSubscribeRallyPointOnMission } from '@/lib/rallyPoint/shouldSubscribeRallyPointOnMission';
import { shouldUseMissionRealtimeTables } from '@/lib/realtime/shouldUseMissionRealtimeTables';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import { formatVariantBadge, type MovementVariantSelection } from '@/lib/mission/exerciseScaling';
import { versionKeyFor } from '@/lib/mission/movementVersion';
import { shouldShowPacerPicker } from '@/lib/mission/shouldShowPacerPicker';
import { clearScalingPlan, readScalingPlan, writeScalingPlan } from '@/lib/mission/scalingPlan';
import {
  getStoredRallyPointIdForMission,
  getStoredRallyPointMemberId,
  getStoredRallyPointNickname,
  setStoredRallyPointIdForMission,
} from '@/lib/rallyPointIdentity';
import type { StoredGhostSelection } from '@/lib/missionIdentity';
import { cancelRallyPointCountdown } from '@/lib/api/missionSync';
import {
  effectiveRallyPointCountdownEndsAt,
  elapsedPastRallyPointCountdownSec,
  formatTMinus,
  isPlausibleRallyPointCountdownEndsAt,
  remainingRallyPointCountdownSec,
} from '@/lib/mission/rallyPointCountdown';

const RALLY_POINT_HEARTBEAT_MS = 15_000;

function formatTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

type RestoredMissionIdentity = {
  missionId: string;
  participantId: string;
  nickname: string;
  isHost: boolean;
};

type SyncIdentityBootstrap =
  | { kind: 'ready'; identity: RestoredMissionIdentity }
  | { kind: 'empty' }
  | { kind: 'need-resume'; storedParticipantId: string | null; storedNickname: string };

function readSyncIdentityBootstrap(
  missionId: string,
  isAuthenticated: boolean
): SyncIdentityBootstrap {
  const storedParticipantId = getStoredParticipantId(missionId);
  const storedHostToken = getStoredHostToken(missionId);
  const storedNickname = getStoredNickname(missionId) ?? 'Unknown';

  if (storedParticipantId && storedHostToken) {
    return {
      kind: 'ready',
      identity: {
        missionId,
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
        missionId,
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

export default function MissionWaitingRoomPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();

  const syncBootstrap =
    missionId && !isAuthLoading ? readSyncIdentityBootstrap(missionId, isAuthenticated) : null;
  const needsResume = syncBootstrap?.kind === 'need-resume';
  const resumeKey = `${missionId ?? ''}:${isAuthenticated}:${isAuthLoading}`;

  const [resumeState, setResumeState] = useState<{
    key: string;
    settled: boolean;
    identity: RestoredMissionIdentity | null;
    error: string | null;
  }>({ key: '', settled: false, identity: null, error: null });
  const [hostTokenMissionId, setHostTokenMissionId] = useState(missionId ?? '');
  const [hostTokenPresent, setHostTokenPresent] = useState(() =>
    Boolean(missionId && getStoredHostToken(missionId))
  );

  // Adjust resume bookkeeping when the mission/auth inputs change (render-time pattern).
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

  if ((missionId ?? '') !== hostTokenMissionId) {
    setHostTokenMissionId(missionId ?? '');
    setHostTokenPresent(Boolean(missionId && getStoredHostToken(missionId)));
  }

  useEffect(() => {
    if (!missionId || !needsResume || isAuthLoading) {
      return;
    }

    let cancelled = false;
    const storedParticipantId = getStoredParticipantId(missionId);
    const storedNickname = getStoredNickname(missionId) ?? 'Unknown';

    void resumeMissionIdentity(missionId).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        if (storedParticipantId) {
          setResumeState({
            key: resumeKey,
            settled: true,
            identity: {
              missionId,
              participantId: storedParticipantId,
              nickname: storedNickname,
              isHost: Boolean(getStoredHostToken(missionId)),
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
              missionId,
              participantId: storedParticipantId,
              nickname: storedNickname,
              isHost: Boolean(getStoredHostToken(missionId)),
            },
            error: null,
          });
          return;
        }
        setResumeState({
          key: resumeKey,
          settled: true,
          identity: null,
          error: 'No participant identity found for this mission. Join or create again.',
        });
        return;
      }
      // Actually persist the resumed identity — without this, useLiveAmrapMission
      // (which reads getStoredHostToken() directly for real host RPC calls)
      // never sees the token this resume just fetched, even though the UI
      // above already re-keys itself into the host view.
      persistMissionIdentity(missionId, {
        participantId: result.data.participantId,
        nickname: result.data.nickname,
        hostToken: result.data.hostToken ?? undefined,
      });

      setResumeState({
        key: resumeKey,
        settled: true,
        identity: {
          missionId,
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
  }, [missionId, needsResume, isAuthLoading, resumeKey]);

  const identityBootstrapDone =
    !isAuthLoading &&
    syncBootstrap !== null &&
    (syncBootstrap.kind !== 'need-resume' ||
      (resumeState.key === resumeKey && resumeState.settled));

  const activeRestored: RestoredMissionIdentity | null =
    syncBootstrap?.kind === 'ready'
      ? syncBootstrap.identity
      : resumeState.key === resumeKey
        ? resumeState.identity
        : null;
  const activeResumeError = resumeState.key === resumeKey ? resumeState.error : null;

  if (!missionId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-error">Error: Missing mission ID.</p>
        <AppLink className="link-accent" to="/">
          Back home
        </AppLink>
      </main>
    );
  }

  if (isAuthLoading || !identityBootstrapDone) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-sm text-secondary">Restoring mission identity…</p>
      </main>
    );
  }

  const participantId = activeRestored?.participantId ?? getStoredParticipantId(missionId);
  const nickname = activeRestored?.nickname ?? getStoredNickname(missionId) ?? 'Unknown';

  if (participantId) {
    return (
      <LiveMissionView
        key={`${missionId}:${hostTokenPresent ? 'host' : 'joiner'}`}
        missionId={missionId}
        participantId={participantId}
        nickname={nickname}
        onHostAuthorityChange={() => setHostTokenPresent(Boolean(getStoredHostToken(missionId)))}
      />
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <p className="text-error">
        Error:{' '}
        {activeResumeError ??
          'No participant identity found for this mission. Join or create again.'}
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        {!isAuthenticated ? (
          <Link className="link-accent" to="/join">
            Join mission
          </Link>
        ) : null}
        <Link className="link-accent" to="/my-missions">
          My missions
        </Link>
        <Link className="link-accent" to="/create">
          Plan mission
        </Link>
      </div>
    </main>
  );
}

function LiveMissionView({
  missionId,
  participantId,
  nickname,
  onHostAuthorityChange,
}: {
  missionId: string;
  participantId: string;
  nickname: string;
  onHostAuthorityChange?: () => void;
}) {
  const navigate = useNavigate();
  const claimToken = getStoredClaimToken(missionId);
  const { isAuthenticated, isAuthLoading, user } = useAmrapAuth();
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [forceNavError, setForceNavError] = useState<string | null>(null);
  // Create hands over a chain-save failure here rather than stranding the host
  // on the form with a live mission they cannot reach.
  const location = useLocation();
  const [chainSaveError] = useState<string | null>(() => {
    const state = location.state;
    return state && typeof state === 'object' && 'chainSaveError' in state
      ? ((state as { chainSaveError?: unknown }).chainSaveError as string) || null
      : null;
  });
  const [daisyExitError, setDaisyExitError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [hostRestartedDeadEnd, setHostRestartedDeadEnd] = useState(false);
  const [isSubmittingPartialReps, setIsSubmittingPartialReps] = useState(false);
  const [amqapAutoLockFailed, setAmqapAutoLockFailed] = useState(false);
  const amqapAutoLockAttemptedRef = useRef(false);
  // A modification chosen before the clock starts. Seeds the end-of-mission checklist;
  // the checklist is still the only thing that writes a result.
  const [scalingPlan, setScalingPlan] = useState<MovementVariantSelection>({});
  const [scorecardDismissed, setScorecardDismissed] = useState(false);
  const [missionLoadingDismissed, setMissionLoadingDismissed] = useState(false);
  const [authOpenForSave, setAuthOpenForSave] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const pendingSaveAfterAuth = useRef(false);
  const [ghostSelection, setGhostSelection] = useState<StoredGhostSelection | null>(() =>
    getStoredGhostSelection(missionId)
  );
  // Copilot suggestion ignored: activeGhostSelection already gates stored selection on isAuthenticated.
  const activeGhostSelection = isAuthenticated ? ghostSelection : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const audioUnlockedRef = useRef(false);
  const {
    activeNotice: activeSafetyNotice,
    safetyNoticesComplete,
    confirmSafetyNotice,
  } = useMissionSafetyNotices(missionId);

  const useRealtimeTables = shouldUseMissionRealtimeTables({
    isAuthenticated,
    hasClaimToken: Boolean(claimToken),
  });

  const channel = useMissionChannel(
    missionId,
    { participantId, nickname },
    {
      realtimeTables: useRealtimeTables,
    }
  );
  const live = useLiveAmrapMission(missionId, channel);
  const { isHost, start: startMission, phase: livePhase } = live;
  const livePhaseRef = useRef(livePhase);
  livePhaseRef.current = livePhase;
  const rallyPointEnteredRef = useRef(false);
  const rallyPointLeftRef = useRef(false);
  const rallyPointEnteredAtMsRef = useRef<number | null>(null);
  const amqapFlow = findAmqapFlow(live.templateId);
  const amqapSets = useMemo(() => (amqapFlow ? expandAmqapSets(amqapFlow) : []), [amqapFlow]);
  const amqapProgress =
    amqapFlow && live.phase === 'work'
      ? setProgressFromRoundElapsed(
          elapsedInRoundSec(live.elapsedSec, live.roundSplitsSec),
          amqapSets
        )
      : null;
  const amqapCurrentMovementIndex = amqapProgress?.set.movementIndex ?? null;
  const missionLockedModal = useMissionLockedModal(livePhase, live.isPractice);

  const rallyPointId =
    channel.mission?.rally_point_id ?? getStoredRallyPointIdForMission(missionId) ?? null;
  const [nextUpMissionName, setNextUpMissionName] = useState<string | null>(null);
  const [nextChainedMissionId, setNextChainedMissionId] = useState<string | null>(null);
  const [continueMissionName, setContinueMissionName] = useState<string | null>(null);
  const [chainRestBanner, setChainRestBanner] = useState<string | null>(null);
  const [chainPlanSummary, setChainPlanSummary] = useState<string | null>(null);
  const chainAdvanceAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (channel.mission?.rally_point_id) {
      setStoredRallyPointIdForMission(missionId, channel.mission.rally_point_id);
    }
  }, [channel.mission?.rally_point_id, missionId]);

  useEffect(() => {
    setNextChainedMissionId(null);
    setContinueMissionName(null);
    chainAdvanceAttemptedRef.current = null;
    amqapAutoLockAttemptedRef.current = false;
    setAmqapAutoLockFailed(false);
    rallyPointEnteredRef.current = false;
    rallyPointLeftRef.current = false;
    rallyPointEnteredAtMsRef.current = null;
  }, [missionId]);

  useEffect(() => {
    if (!channel.mission || live.isPractice) {
      return;
    }
    if (!isWaitingRoomPresenceState(channel.mission.state)) {
      return;
    }
    if (rallyPointEnteredRef.current) {
      return;
    }
    rallyPointEnteredRef.current = true;
    rallyPointEnteredAtMsRef.current = Date.now();
    track('rally_point_entered', {}, { missionId });
  }, [channel.mission, channel.mission?.state, live.isPractice, missionId]);

  useEffect(() => {
    function fireRallyPointLeft(reason: RallyPointLeaveReason, useBeacon: boolean) {
      if (!rallyPointEnteredRef.current || rallyPointLeftRef.current) {
        return;
      }
      rallyPointLeftRef.current = true;
      const enteredAt = rallyPointEnteredAtMsRef.current ?? Date.now();
      const props = {
        reason,
        duration_sec: rallyPointStayDurationSec(enteredAt, Date.now()),
      };
      if (useBeacon) {
        trackBeacon('rally_point_left', props, { missionId });
      } else {
        track('rally_point_left', props, { missionId });
      }
    }

    if (livePhase === 'work') {
      fireRallyPointLeft('started', false);
      return;
    }

    if (channel.mission?.state === 'finished' && livePhase === 'waiting') {
      fireRallyPointLeft('closed', false);
    }
  }, [livePhase, channel.mission?.state, missionId]);

  useEffect(() => {
    function leaveNavigatingAway() {
      const phase = livePhaseRef.current;
      if (phase === 'work' || phase === 'finished') {
        return;
      }
      if (!rallyPointEnteredRef.current || rallyPointLeftRef.current) {
        return;
      }
      rallyPointLeftRef.current = true;
      const enteredAt = rallyPointEnteredAtMsRef.current ?? Date.now();
      trackBeacon(
        'rally_point_left',
        {
          reason: 'navigated_away',
          duration_sec: rallyPointStayDurationSec(enteredAt, Date.now()),
        },
        { missionId }
      );
    }

    window.addEventListener('pagehide', leaveNavigatingAway);
    return () => {
      window.removeEventListener('pagehide', leaveNavigatingAway);
      leaveNavigatingAway();
    };
  }, [missionId]);

  // AMQAP: lock a 0-partial score on finish so HUD Active Recovery / week volume
  // record without the metabolic "Where did you break?" PartialReps step.
  useEffect(() => {
    if (
      !shouldAutoLockAmqapScore({
        isAmqap: Boolean(amqapFlow),
        isPractice: live.isPractice,
        phase: livePhase,
        hasSubmittedPartialReps: live.hasSubmittedPartialReps,
        hasParticipant: Boolean(live.participantId),
      })
    ) {
      return;
    }
    if (amqapAutoLockAttemptedRef.current) {
      return;
    }
    amqapAutoLockAttemptedRef.current = true;
    let cancelled = false;
    void (async () => {
      const ok = await live.submitPartialReps(0);
      if (cancelled) {
        return;
      }
      if (ok) {
        clearScalingPlan(missionId, participantId);
        setAmqapAutoLockFailed(false);
        return;
      }
      setAmqapAutoLockFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    amqapFlow,
    live.isPractice,
    livePhase,
    live.hasSubmittedPartialReps,
    live.participantId,
    live.submitPartialReps,
    missionId,
    participantId,
  ]);

  useEffect(() => {
    if (!rallyPointId || !isAuthenticated) {
      setNextUpMissionName(null);
      setChainRestBanner(null);
      setChainPlanSummary(null);
      return;
    }

    let cancelled = false;
    void getMissionChain(rallyPointId).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setNextUpMissionName(null);
        setChainRestBanner(null);
        setChainPlanSummary(null);
        return;
      }
      setNextUpMissionName(nextChainedMissionName(result.data));
      setChainRestBanner(
        livePhase === 'waiting' ? chainRestBannerForMission(result.data, missionId) : null
      );
      setChainPlanSummary(
        livePhase === 'waiting' ? chainPlanSummaryForMission(result.data, missionId) : null
      );
    });

    return () => {
      cancelled = true;
    };
  }, [rallyPointId, isAuthenticated, livePhase, missionId]);

  const rallyPointMemberId = rallyPointId ? getStoredRallyPointMemberId(rallyPointId) : null;
  const rallyPointNickname =
    (rallyPointId ? getStoredRallyPointNickname(rallyPointId) : null) ?? nickname;
  const rallyPointChannelPresence =
    rallyPointId && rallyPointMemberId && rallyPointNickname
      ? { memberId: rallyPointMemberId, nickname: rallyPointNickname }
      : null;
  const rallyPointChannel = useRallyPointChannel(
    rallyPointId && shouldSubscribeRallyPointOnMission(livePhase) ? rallyPointId : undefined,
    rallyPointChannelPresence,
    { realtimeTables: useRealtimeTables }
  );

  useRallyPointHostHandoff({
    hostUserId: rallyPointChannel.rallyPoint?.hostUserId,
    activeMissionId: rallyPointChannel.rallyPoint?.activeMissionId ?? missionId,
    userId: user?.id,
    enabled: Boolean(rallyPointId) && (livePhase === 'waiting' || livePhase === 'setup'),
    onHostAuthorityChange,
  });

  // Host advances the pre-planned queue once the finished state is confirmed.
  useEffect(() => {
    if (
      !shouldAdvanceMissionChain({
        isHost,
        isPractice: live.isPractice,
        livePhase,
        rallyPointId,
        isAuthenticated,
        currentMissionId: missionId,
        activeMissionId: rallyPointChannel.rallyPoint?.activeMissionId,
        attemptedForMissionId: chainAdvanceAttemptedRef.current,
        scoreLocked: live.hasSubmittedPartialReps,
      })
    ) {
      return;
    }
    // Narrowing only — shouldAdvanceMissionChain has already rejected a missing
    // hub id, but the predicate cannot tell the type system that.
    const hubId = rallyPointId;
    if (!hubId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const chain = await getMissionChain(hubId);
      if (cancelled) {
        return;
      }
      if (chain.error || !chain.data) {
        return;
      }
      if (!chainHasUnstartedItems(chain.data)) {
        chainAdvanceAttemptedRef.current = missionId;
        return;
      }
      if (chainAdvanceAttemptedRef.current === missionId) {
        return;
      }
      chainAdvanceAttemptedRef.current = missionId;

      const queuedName = nextChainedMissionName(chain.data);
      const result = await startNextChainedMission(hubId);
      if (cancelled) {
        // The mission may well have started. Clearing the stamp lets the effect
        // re-run and pick the outcome up, rather than leaving the host with no
        // Continue button and no way to ask for one.
        chainAdvanceAttemptedRef.current = null;
        return;
      }
      if (result.error) {
        chainAdvanceAttemptedRef.current = null;
        setForceNavError(result.error.message);
        return;
      }
      if (!result.data || result.data.complete) {
        return;
      }

      const advancedMissionId = result.data.missionId;
      setNextChainedMissionId(advancedMissionId);
      // Prefer the post-advance stamp: heal may skip pos0 so pre-call next name is stale.
      void getMissionChain(hubId).then((refresh) => {
        if (cancelled || refresh.error || !refresh.data) {
          setContinueMissionName(queuedName);
          return;
        }
        const started = refresh.data.find((item) => item.startedMissionId === advancedMissionId);
        setContinueMissionName(started ? resolveWorkoutTitle(started.templateId) : queuedName);
        setNextUpMissionName(nextChainedMissionName(refresh.data));
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHost,
    live.isPractice,
    livePhase,
    live.hasSubmittedPartialReps,
    rallyPointId,
    isAuthenticated,
    missionId,
    // The hub row can land after the finished state does, so the advance has
    // to re-run when it catches up rather than giving up on the first pass.
    rallyPointChannel.rallyPoint?.activeMissionId,
  ]);

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
      if (result.hostToken && result.activeMissionId) {
        setStoredHostToken(result.activeMissionId, result.hostToken);
      }
      onHostAuthorityChange?.();
      void rallyPointChannel.refresh();
    },
  });

  const walkthrough = useRallyPointWalkthrough({
    missionId,
    isHost,
    enabled: safetyNoticesComplete && livePhase === 'waiting',
  });
  const missionReady = safetyNoticesComplete && walkthrough.complete;
  const { unlock: unlockAudio, playRoundLogged } = useTacticalAudio({
    phase: live.phase,
    timeLeftSec: live.timeLeftSec,
    isPaused: live.isPaused,
    workDurationSec: live.workDurationSec,
  });
  const {
    buttonRef: roundLogButtonRef,
    pulseKey: roundLogPulseKey,
    pulse: pulseRoundLog,
    reset: resetRoundLogPulse,
  } = useRoundLogPulse();
  const lastLogRoundAtMsRef = useRef<number | null>(null);
  const [logRoundHint, setLogRoundHint] = useState<string | null>(null);
  const claim = useParticipantClaim(missionId);
  const [roomJoinNotice, setRoomJoinNotice] = useState<string | null>(null);
  const selfLeaderboardEntry = live.leaderboard.find((entry) => entry.isSelf) ?? null;
  const selfBaseScore = selfLeaderboardEntry?.baseScore ?? 0;
  // Always the raw reps/rounds this athlete did — never finalScore, which is
  // baseScore adjusted by P.V.I. and Domain and is worth more or less than
  // the actual reps performed. Showing that number next to the word "reps"
  // once the mission finishes used to claim the athlete did more (or fewer)
  // reps than they actually did.
  const selfScoreLabel = formatMobileLiveScoreLabel(
    selfBaseScore,
    live.repsPerRound,
    live.myRoundCount
  );
  const selfRank = live.selfRank;

  const rallyPointCountdownEndsAt = effectiveRallyPointCountdownEndsAt(
    live.rallyPointCountdownEndsAt,
    nowMs
  );
  const rallyPointRemaining = remainingRallyPointCountdownSec(rallyPointCountdownEndsAt, nowMs);
  const rallyPointCountdownArmed = livePhase === 'waiting' && rallyPointCountdownEndsAt !== null;
  const rallyPointTicking =
    rallyPointCountdownArmed && rallyPointRemaining !== null && rallyPointRemaining > 0;
  const rallyPointIgnited = rallyPointCountdownArmed && rallyPointRemaining === 0;
  const rallyPointOvertimeSec = rallyPointIgnited
    ? elapsedPastRallyPointCountdownSec(rallyPointCountdownEndsAt, nowMs)
    : null;

  // Far-future ends_at cannot come from Start countdown (max 10 min). Clear it so
  // scheduled rallies keep Set duration / Start countdown until the host arms.
  useEffect(() => {
    if (!isHost || livePhase !== 'waiting') {
      return;
    }
    const rawEndsAt = live.rallyPointCountdownEndsAt;
    if (!rawEndsAt || isPlausibleRallyPointCountdownEndsAt(rawEndsAt, Date.now())) {
      return;
    }
    const hostToken = getStoredHostToken(missionId);
    if (!hostToken) {
      return;
    }
    void cancelRallyPointCountdown({ missionId, hostToken });
  }, [isHost, live.rallyPointCountdownEndsAt, livePhase, missionId]);

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
    missionId,
    ghostSelection: activeGhostSelection,
    repsPerRound: live.repsPerRound,
    workDurationSec: live.workDurationSec,
    elapsedSec: live.elapsedSec,
    selfBaseScore,
  });

  const showGhostPicker = shouldShowPacerPicker({
    templateId: live.templateId,
    phase: livePhase,
  });
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
            disabled={!missionReady}
            onClick={() => {
              handleAudioUnlock();
              void startMission({
                source: resolveMissionStartSource({
                  countdownArmed: rallyPointCountdownArmed,
                  hasChainRest: Boolean(chainRestBanner),
                }),
              });
            }}
          >
            Start
          </button>
        ) : null}
        {showPractice ? (
          <button
            type="button"
            className="btn-outline px-3 py-1.5 text-sm"
            disabled={!missionReady}
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
  const showReset = shouldShowMissionReset({
    isPractice: live.isPractice,
    isHost,
    isFeatured: channel.mission?.is_featured === true,
    phase: livePhase,
  });
  const showLogRound = livePhase === 'work' && !live.isPaused;
  const compactMobileLive = hideMobileLiveChrome(live.phase);
  const omitMobileLiveHowTo = shouldOmitMobileLiveHowTo(live.phase);
  const denseMobileLiveWorkout = shouldDenseMobileLiveWorkout(live.phase, live.workout.length);

  function handleLogRound() {
    const nowMs = Date.now();
    if (!canLogRound(lastLogRoundAtMsRef.current, nowMs)) {
      setLogRoundHint(LOG_ROUND_COOLDOWN_ALERT);
      return;
    }
    const previousStamp = lastLogRoundAtMsRef.current;
    // Stamp before the await so a double-press during flight cannot bank two.
    lastLogRoundAtMsRef.current = nowMs;
    setLogRoundHint(null);
    void live.logRound().then((ok) => {
      if (!ok) {
        lastLogRoundAtMsRef.current = previousStamp;
        return;
      }
      playRoundLogged();
      pulseRoundLog();
    });
  }

  const handleLogRoundRef = useRef(handleLogRound);
  useEffect(() => {
    handleLogRoundRef.current = handleLogRound;
  });

  useEffect(() => {
    if (!showLogRound) {
      resetRoundLogPulse();
      setLogRoundHint(null);
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!shouldHandleLogRoundHotkey(event)) {
        return;
      }
      event.preventDefault();
      handleLogRoundRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLogRound, resetRoundLogPulse]);

  const showEndPractice = live.isPractice && livePhase === 'finished';
  const showPartialRepsModal =
    !live.isPractice &&
    livePhase === 'finished' &&
    live.repsPerRound > 0 &&
    !live.hasSubmittedPartialReps &&
    // AMQAP auto-locks; only fall back to PartialReps if that submit failed.
    (!amqapFlow || amqapAutoLockFailed);
  const amqapLockPending =
    Boolean(amqapFlow) &&
    !live.isPractice &&
    livePhase === 'finished' &&
    !live.hasSubmittedPartialReps;
  const showScorecard =
    !live.isPractice &&
    livePhase === 'finished' &&
    live.hasSubmittedPartialReps &&
    !scorecardDismissed &&
    selfLeaderboardEntry !== null;
  const canSave = canOfferMissionSave({
    claimToken,
    participantId,
    claimStatus: claim.claimStatus,
  });

  // canSave, not claim.showClaimPrompt: the latter requires being signed in
  // already, and the whole point of this sheet is the athlete who is not. A
  // guest finishing a room mission is exactly who it exists for, and gating it
  // on authentication put it in front of everyone except them.
  const showFinishedClaimPrompt =
    !live.isPractice &&
    livePhase === 'finished' &&
    canSave &&
    !showPartialRepsModal &&
    !amqapLockPending &&
    !showScorecard;

  const forceNav = useRallyPointForceNav({
    rallyPointId,
    activeMissionId: rallyPointChannel.rallyPoint?.activeMissionId,
    activeMissionState: rallyPointChannel.rallyPoint?.activeMissionState,
    currentMissionId: missionId,
    enabled: shouldPullViewerToActiveMission({
      rallyPointId,
      livePhase,
      isHost,
      currentMissionId: missionId,
      activeMissionId: rallyPointChannel.rallyPoint?.activeMissionId,
      activeMissionState: rallyPointChannel.rallyPoint?.activeMissionState,
      nextChainedMissionId,
      showPartialRepsModal: showPartialRepsModal || amqapLockPending,
      showScorecard,
    }),
    onError: setForceNavError,
  });

  useEffect(() => {
    if (isHost || live.isPractice || channel.mission || !channel.error) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const storedRallyPointId = getStoredRallyPointIdForMission(missionId);
      if (!storedRallyPointId) {
        if (!cancelled) {
          setHostRestartedDeadEnd(true);
        }
        return;
      }

      const snapshot = await getRallyPoint(storedRallyPointId);
      if (cancelled) {
        return;
      }
      if (snapshot.error || !snapshot.data) {
        setHostRestartedDeadEnd(true);
        return;
      }

      const nextId = snapshot.data.activeMissionId;
      const nextState = snapshot.data.activeMissionState;
      if (!nextId || nextId === missionId || !isLiveRallyPointMissionState(nextState)) {
        setHostRestartedDeadEnd(true);
        return;
      }

      const joined = await joinRallyPoint({
        rallyPointId: storedRallyPointId,
        nickname:
          getStoredRallyPointNickname(storedRallyPointId) ??
          getStoredNickname(missionId) ??
          nickname,
      });
      if (cancelled) {
        return;
      }
      if (joined.error) {
        setHostRestartedDeadEnd(true);
        setForceNavError(joined.error.message);
        return;
      }

      if (joined.data?.missionId) {
        setStoredRallyPointIdForMission(joined.data.missionId, storedRallyPointId);
        navigate(`/mission/${joined.data.missionId}`, { replace: true });
        return;
      }

      setHostRestartedDeadEnd(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isHost, live.isPractice, channel.mission, channel.error, missionId, nickname, navigate]);

  async function handleResetMission() {
    if (resetBusy) {
      return;
    }
    if (!live.isPractice) {
      const confirmed = window.confirm('You are ending this mission and restarting the mission');
      if (!confirmed) {
        return;
      }
    }

    setResetBusy(true);
    setResetError(null);
    try {
      const result = await live.resetMission();
      if (result.error) {
        setResetError(result.error);
        return;
      }
      if (result.missionId) {
        const rp =
          getStoredRallyPointIdForMission(missionId) ?? channel.mission?.rally_point_id ?? null;
        if (rp) {
          setStoredRallyPointIdForMission(result.missionId, rp);
        }
        navigate(`/mission/${result.missionId}`, { replace: true });
      }
    } finally {
      setResetBusy(false);
    }
  }

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
      clearStoredHostToken(missionId);
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

  const scorecardSaveState: MissionScorecardSaveState =
    claim.claimStatus === 'claimed'
      ? 'saved'
      : claim.isClaiming
        ? 'saving'
        : canSave
          ? 'idle'
          : 'unavailable';

  // Seed the picker once the workout has arrived. Keyed on the movement names
  // rather than the array identity, so a realtime refresh of the same workout
  // does not stamp over a choice the athlete just made.
  // JSON rather than a delimiter, so a movement name is never split on its own
  // punctuation on the way back out.
  const workoutFingerprint = JSON.stringify(live.workout.map((exercise) => exercise.name));
  useEffect(() => {
    const names = JSON.parse(workoutFingerprint) as string[];
    if (names.length === 0) {
      return;
    }
    setScalingPlan(
      readScalingPlan(
        missionId,
        participantId,
        names.map((name) => ({ name }))
      )
    );
  }, [missionId, participantId, workoutFingerprint]);

  // The pacer offers the athlete's best run of this exact version, so it has to
  // follow the picker rather than the workout: change the scaling and the ghost
  // worth racing changes with it.
  const scalingVersionKey = versionKeyFor({
    modifiedMovements: Object.keys(scalingPlan),
    movementVariants: scalingPlan,
  });
  const scalingVersionLabel = formatVariantBadge(scalingPlan);

  const handleScalingPlanChange = (variants: MovementVariantSelection) => {
    setScalingPlan(variants);
    writeScalingPlan(missionId, participantId, variants);
  };

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

  const handleSubmitPartialReps = async (
    partialReps: number,
    modifiedMovements: string[],
    movementVariants: Record<string, string>,
    checkIn: {
      rpe: number | null;
      sessionNotes: string;
      checkIns: Record<string, string>;
    }
  ) => {
    setIsSubmittingPartialReps(true);
    try {
      await live.submitPartialReps(partialReps, modifiedMovements, movementVariants, checkIn);
      // The result row is now the record; the draft has nothing left to say.
      clearScalingPlan(missionId, participantId);
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
      ? 'Start begins the mission now. Countdown is optional — use it for friends or a timed T-minus.'
      : 'Waiting on host for mission control.';
  // Waiting room stays "Rally point"; once the clock is running this screen is the mission.
  const headerTitle = live.phase === 'waiting' && !live.isPractice ? 'Rally point' : 'Mission';
  const headerSubtitle = live.phase === 'waiting' || live.isPractice ? hostStatusText : undefined;

  if (hostRestartedDeadEnd) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <AppHeader title={headerTitle} />
        <p className="text-error">
          The host restarted this mission. Ask them for a new invite link.
        </p>
        {forceNavError ? <p className="text-error text-sm">{forceNavError}</p> : null}
        {chainSaveError ? (
          <p className="text-error text-sm">
            This mission started, but the rest of the chain could not be saved: {chainSaveError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="link-accent" to="/join">
            Join mission
          </Link>
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`mx-auto space-y-6 bg-page pt-0 lg:flex lg:h-dvh lg:max-w-none lg:flex-col lg:space-y-0 lg:overflow-hidden lg:p-0 ${
        compactMobileLive ? 'max-w-lg px-0 pb-6 max-lg:max-w-none' : 'max-w-lg px-6 pb-6'
      }`}
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
        <AppHeader title={headerTitle} subtitle={headerSubtitle} desktopTitleAsPageHeading />

        <div
          className={`space-y-6 pb-6 pt-0 lg:mx-auto lg:w-full lg:max-w-7xl lg:shrink-0 lg:space-y-4 lg:px-8 lg:pb-0 lg:pt-6 ${
            compactMobileLive ? 'px-3' : 'px-6'
          }`}
        >
          {forceNav.pendingMissionId ? (
            <div
              className="border-accent/40 flex flex-wrap items-center justify-between gap-3 border bg-surface px-4 py-3"
              role="status"
            >
              <p className="text-sm text-ink">
                Next mission starting
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
          {resetError ? <p className="alert-error">{resetError}</p> : null}

          {rallyPointId && rallyPointChannel.error ? (
            <p className="alert-error">{rallyPointChannel.error}</p>
          ) : null}

          {claim.claimError && <p className="alert-error">{claim.claimError}</p>}

          {claim.claimMessage && <p className="alert-success">{claim.claimMessage}</p>}

          {/* One sheet at the finish. For a room mission it carries the join
              checkbox alongside the save; for a personal mission it is the
              same save prompt it always was. */}
          {/* The join result lives out here on purpose: a successful save flips
              the claim status and the sheet stops rendering, so a notice held
              inside it would unmount before anyone read it. */}
          {roomJoinNotice ? (
            <section className="card bg-success-tint p-4 text-sm text-success-text">
              {roomJoinNotice}
            </section>
          ) : null}

          {showFinishedClaimPrompt && missionId && (
            <RoomFinishSheet
              // Keyed by mission: without it the previous mission's room could
              // survive a route change and be joined instead of this one's.
              key={missionId}
              missionId={missionId}
              canSave
              isSaving={claim.isClaiming}
              onSave={() => claim.saveToAccount()}
              onJoinResult={setRoomJoinNotice}
            />
          )}

          {claim.showClaimPrompt && live.phase !== 'finished' && (
            <section className="card p-4 text-sm">
              {/* Copilot suggestion ignored: mid-mission save CTA is also gated by authenticated claim.showClaimPrompt. */}
              <button
                type="button"
                className="btn-outline"
                disabled={claim.isClaiming}
                onClick={() => claim.saveToAccount()}
              >
                {claim.isClaiming ? 'Saving…' : 'Save this mission to my account'}
              </button>
            </section>
          )}
        </div>

        <div
          className={`lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-7xl lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 lg:overflow-hidden lg:px-8 lg:py-6 ${
            compactMobileLive ? 'space-y-3 px-3' : 'space-y-6 px-6'
          }`}
        >
          <div
            className={`lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden ${
              compactMobileLive ? 'space-y-3' : 'space-y-6'
            }`}
          >
            <div
              className={`lg:flex lg:min-h-0 lg:shrink lg:flex-col lg:gap-3 lg:space-y-0 lg:overflow-y-auto lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-4 lg:shadow-card ${
                compactMobileLive ? 'space-y-3' : 'space-y-4'
              }`}
            >
              <section
                className="card space-y-1.5 p-3 text-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
                data-walkthrough-id="status"
              >
                {live.phase === 'waiting' ? (
                  <WaitingTypewriterLabel />
                ) : (
                  <p className="text-display text-xs uppercase tracking-widest text-secondary">
                    {formatMissionStateLabel(live.phase)}
                  </p>
                )}
                {chainRestBanner ? (
                  <p className="text-sm text-secondary" role="status">
                    {chainRestBanner}
                  </p>
                ) : null}
                {chainPlanSummary ? (
                  <p className="text-sm text-secondary" role="status">
                    {chainPlanSummary}
                  </p>
                ) : null}
                {live.phase === 'waiting' && (rallyPointTicking || rallyPointIgnited) ? (
                  <p className="font-mono text-3xl tabular-nums tracking-widest text-accent lg:text-5xl">
                    {formatTMinus(rallyPointRemaining ?? 0)}
                  </p>
                ) : live.phase !== 'waiting' ? (
                  <p
                    key={roundLogPulseKey}
                    className={`text-display tabular-nums text-accent lg:text-7xl xl:text-8xl ${
                      compactMobileLive ? 'text-7xl' : 'text-5xl'
                    } ${roundLogPulseKey > 0 ? 'animate-round-log-flash' : ''}`}
                  >
                    {formatTime(live.timeLeftSec)}
                  </p>
                ) : null}
                {isHost && rallyPointCountdownArmed ? (
                  <div className="flex justify-center pt-1">
                    <ArmedRallyPointControls
                      missionId={missionId}
                      ticking={rallyPointTicking}
                      overtimeSec={rallyPointOvertimeSec}
                      actionsEnabled={missionReady}
                      onAudioUnlock={handleAudioUnlock}
                      onStart={() => {
                        handleAudioUnlock();
                        void startMission({
                          source: resolveMissionStartSource({
                            countdownArmed: rallyPointCountdownArmed,
                            hasChainRest: Boolean(chainRestBanner),
                          }),
                        });
                      }}
                    />
                  </div>
                ) : null}
                {live.phase === 'work' || live.phase === 'finished' ? (
                  <>
                    <div
                      className={`flex items-center justify-center gap-3 text-secondary lg:hidden ${
                        compactMobileLive ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {selfRank !== null ? (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                            selfRank === 1
                              ? 'border-accent/40 bg-accent-tint text-accent'
                              : 'border-border bg-page text-ink'
                          }`}
                          aria-label={`Rank ${selfRank}`}
                        >
                          #{selfRank}
                        </span>
                      ) : null}
                      <p aria-label={selfScoreLabel}>
                        <span className="font-semibold tabular-nums text-ink">
                          {selfScoreLabel}
                        </span>
                      </p>
                      <p>
                        Elapsed: <span className="tabular-nums">{formatTime(live.elapsedSec)}</span>
                      </p>
                    </div>
                    <p className="hidden text-sm text-secondary lg:block">
                      Elapsed: {formatTime(live.elapsedSec)}
                    </p>
                  </>
                ) : null}
                <p className={`text-xs text-muted ${compactMobileLive ? 'max-lg:hidden' : ''}`}>
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

              {isHost && live.phase === 'waiting' ? (
                <HostRallyPointSteps
                  missionId={missionId}
                  rallyPointId={rallyPointId}
                  countdownArmed={rallyPointCountdownArmed}
                  actionsEnabled={missionReady}
                  onAudioUnlock={handleAudioUnlock}
                  showPacer={showGhostPicker}
                  ghostVersionKey={scalingVersionKey}
                  ghostVersionLabel={scalingVersionLabel}
                  templateId={live.templateId}
                  durationMinutes={live.workDurationSec / 60}
                  ghostSelection={ghostSelection}
                  onGhostChange={setGhostSelection}
                />
              ) : null}

              {live.phase === 'waiting' && live.scheduledAt ? (
                isHost ? (
                  <EditRallyScheduleForm
                    key={live.scheduledAt}
                    missionId={missionId}
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

              {!isHost && live.phase === 'waiting' ? (
                <CopyInviteLink missionId={missionId} rallyPointId={rallyPointId} />
              ) : null}

              {/*
                Joiners never had a pacer at all: the picker lives inside the
                host's rally-point steps, and the old gate meant the only person
                who ever saw it was a host training alone. Their own choice,
                private to them — the host does not pick pacers for the squad.
              */}
              {!isHost && showGhostPicker && live.templateId ? (
                <GhostPicker
                  missionId={missionId}
                  templateId={live.templateId}
                  durationMinutes={live.workDurationSec / 60}
                  value={ghostSelection}
                  onChange={setGhostSelection}
                  versionKey={scalingVersionKey}
                  versionLabel={scalingVersionLabel}
                />
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
                className={`flex flex-wrap gap-2 lg:justify-center ${
                  showLogRound ? 'max-lg:flex-col max-lg:items-stretch' : ''
                }`}
                {...(waitingStartPracticeActions ? {} : { 'data-walkthrough-id': 'actions' })}
              >
                {showReset && (
                  <button
                    type="button"
                    className={`btn-outline px-3 py-1.5 text-sm lg:px-6 lg:py-3 lg:text-base ${
                      showLogRound ? 'max-lg:w-full max-lg:py-3 max-lg:text-base' : ''
                    }`}
                    disabled={resetBusy}
                    onClick={() => {
                      handleAudioUnlock();
                      void handleResetMission();
                    }}
                  >
                    {resetBusy ? 'Resetting…' : 'Reset'}
                  </button>
                )}
                {showLogRound && (
                  <span className="relative inline-flex max-lg:w-full">
                    <button
                      ref={roundLogButtonRef}
                      type="button"
                      className="btn-success w-full px-3 py-1.5 text-sm max-lg:py-5 max-lg:text-xl lg:w-auto lg:px-6 lg:py-3 lg:text-base"
                      onClick={handleLogRound}
                    >
                      Log round
                    </button>
                    <RoundLogRippleBurst
                      pulseKey={roundLogPulseKey}
                      buttonRef={roundLogButtonRef}
                    />
                  </span>
                )}
                {showLogRound && logRoundHint ? (
                  <p className="w-full text-center text-sm text-secondary" role="status">
                    {logRoundHint}
                  </p>
                ) : null}
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

              {showLogRound && live.canLogMissedRound ? (
                <section className="flex justify-center">
                  <LogMissedRound
                    roundNumber={live.myRoundCount + 1}
                    repsPerRound={live.repsPerRound}
                    preview={live.previewMissedRound}
                    onConfirm={(reps) => {
                      const nowMs = Date.now();
                      if (!canLogRound(lastLogRoundAtMsRef.current, nowMs)) {
                        setLogRoundHint(LOG_ROUND_COOLDOWN_ALERT);
                        return;
                      }
                      const previousStamp = lastLogRoundAtMsRef.current;
                      lastLogRoundAtMsRef.current = nowMs;
                      setLogRoundHint(null);
                      void live.logMissedRound(reps).then((ok) => {
                        if (!ok) {
                          lastLogRoundAtMsRef.current = previousStamp;
                          return;
                        }
                        playRoundLogged();
                        pulseRoundLog();
                      });
                    }}
                  />
                </section>
              ) : null}

              {/* Its own section, after the actions — never inside the clock
                  block. The dial owns placement and failure isolation here;
                  AMQAP row highlighting uses expandAmqapSets / amqapSetGauge
                  separately on the workout list. */}
              {amqapFlow ? (
                <MissionAmqapGauge
                  phase={live.phase}
                  flow={amqapFlow}
                  roundSplitsSec={live.roundSplitsSec}
                  elapsedSec={live.elapsedSec}
                  isPaused={live.isPaused}
                />
              ) : (
                <MissionPacingGauge
                  phase={live.phase}
                  roundSplitsSec={live.roundSplitsSec}
                  elapsedSec={live.elapsedSec}
                  isPaused={live.isPaused}
                  isPractice={live.isPractice}
                />
              )}

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
              <section
                className={`card shrink-0 space-y-2 p-4 ${
                  denseMobileLiveWorkout ? 'max-lg:space-y-1 max-lg:p-3' : ''
                }`}
                data-walkthrough-id="workout"
              >
                <h2
                  className={`text-display text-center text-ink lg:text-3xl ${
                    denseMobileLiveWorkout ? 'text-xl' : compactMobileLive ? 'text-2xl' : 'text-xl'
                  }`}
                >
                  {resolveWorkoutTitle(live.templateId)}
                </h2>
                <ul
                  className={`space-y-1 lg:space-y-4 ${
                    denseMobileLiveWorkout
                      ? 'text-base max-lg:space-y-0.5'
                      : compactMobileLive
                        ? 'text-base'
                        : 'text-sm'
                  }`}
                >
                  {live.workout.map((exercise, index) => {
                    const isCurrentAmqap = amqapCurrentMovementIndex === index;
                    const currentAmqapSet = isCurrentAmqap ? amqapProgress?.set : undefined;
                    const currentAmqapDetail = currentAmqapSet
                      ? formatAmqapActiveExerciseDetail(currentAmqapSet)
                      : '';
                    return (
                      <li
                        key={`${exercise.name}-${index}`}
                        aria-current={isCurrentAmqap ? 'true' : undefined}
                        className={`flex items-center gap-2 lg:gap-4 ${
                          isCurrentAmqap
                            ? 'bg-accent/15 rounded-card px-2 py-1.5 ring-1 ring-inset ring-accent lg:px-3'
                            : ''
                        }`}
                      >
                        <span className="hidden lg:flex lg:h-12 lg:w-12 lg:shrink-0 lg:items-center lg:justify-center lg:rounded-full lg:bg-accent lg:text-xl lg:font-semibold lg:text-on-accent">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 lg:text-2xl lg:leading-snug xl:text-3xl">
                          <span className={isCurrentAmqap ? 'font-semibold text-ink' : undefined}>
                            {formatExerciseLabel(exercise)}
                          </span>
                          {currentAmqapDetail ? (
                            <span className="text-secondary"> · {currentAmqapDetail}</span>
                          ) : null}
                        </span>
                        {omitMobileLiveHowTo ? (
                          <span className="hidden lg:inline-flex">
                            <ExerciseInfoTrigger name={exercise.name} size="lg" />
                          </span>
                        ) : (
                          <ExerciseInfoTrigger name={exercise.name} size="lg" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {live.phase === 'waiting' && !live.isPractice ? (
                  <PreMissionScalingPicker
                    workout={live.workout}
                    variants={scalingPlan}
                    onChange={handleScalingPlanChange}
                  />
                ) : null}
                {live.phase === 'waiting' && !live.isPractice ? (
                  <BenchmarkDesignateControl
                    templateId={live.templateId}
                    durationMinutes={live.workDurationSec / 60}
                    versionKey={scalingVersionKey}
                    movementVariants={scalingPlan}
                  />
                ) : null}
              </section>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-6 lg:overflow-hidden">
            <ParticipantsPanel
              leaderboard={live.leaderboard}
              presence={live.presence}
              selfParticipantId={live.participantId}
              phase={live.phase}
              className={`lg:min-h-0 lg:flex-1 lg:overflow-hidden ${
                compactMobileLive ? 'max-lg:hidden' : ''
              }`}
            />

            <MissionChat
              missionId={missionId}
              participantId={participantId}
              claimToken={claimToken}
              isAuthenticated={isAuthenticated}
              messages={channel.messages}
              expanded={chatExpanded}
              onExpandedChange={setChatExpanded}
              className={[
                chatExpanded
                  ? 'lg:min-h-0 lg:flex-1 lg:overflow-hidden'
                  : 'shrink-0 overflow-hidden',
                compactMobileLive ? 'max-lg:hidden' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />

            {showRallyPointPass && rallyPointChannel.rallyPoint ? (
              <section className="card flex max-h-48 min-h-0 shrink-0 flex-col space-y-3 overflow-hidden p-4 lg:max-h-56 lg:overflow-y-auto">
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

        <section
          className={`space-y-2 pb-6 text-sm text-secondary lg:hidden ${
            compactMobileLive ? 'px-3 max-lg:hidden' : 'px-6'
          }`}
        >
          <p>
            <span className="font-semibold text-ink">Mission ID:</span> {live.missionId}
          </p>
          <p>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </p>
          {daisyExitError ? <p className="text-error text-sm">{daisyExitError}</p> : null}
          {forceNavError ? <p className="text-error text-sm">{forceNavError}</p> : null}
          <div className="flex flex-wrap gap-4">
            {rallyPointHref ? (
              nextUpMissionName ? (
                <p className="text-sm text-secondary">
                  Next up: <span className="font-semibold text-ink">{nextUpMissionName}</span>
                </p>
              ) : (
                <DaisyChainCta className="link-accent text-sm" onActivate={handleDaisyChainExit} />
              )
            ) : (
              <AppLink className="link-accent" to="/">
                Back home
              </AppLink>
            )}
            {rallyPointHref ? (
              <AppLink className="link-accent" to="/">
                Back home
              </AppLink>
            ) : null}
          </div>
        </section>

        <footer className="hidden border-t border-divider bg-surface text-sm text-secondary lg:flex lg:shrink-0 lg:items-center lg:justify-between lg:gap-4 lg:px-8 lg:py-3">
          <span>
            <span className="font-semibold text-ink">Mission ID:</span> {live.missionId}
          </span>
          <span>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </span>
          <span className="flex flex-wrap items-center gap-4">
            {daisyExitError ? <span className="text-error text-sm">{daisyExitError}</span> : null}
            {forceNavError ? <span className="text-error text-sm">{forceNavError}</span> : null}
            {rallyPointHref ? (
              nextUpMissionName ? (
                <p className="text-sm text-secondary">
                  Next up: <span className="font-semibold text-ink">{nextUpMissionName}</span>
                </p>
              ) : (
                <DaisyChainCta className="link-accent text-sm" onActivate={handleDaisyChainExit} />
              )
            ) : (
              <AppLink className="link-accent" to="/">
                Back home
              </AppLink>
            )}
            {rallyPointHref ? (
              <AppLink className="link-accent" to="/">
                Back home
              </AppLink>
            ) : null}
          </span>
        </footer>
      </div>

      {showPartialRepsModal ? (
        <PartialRepsModal
          repsPerRound={live.repsPerRound}
          isSubmitting={isSubmittingPartialReps}
          error={live.syncError}
          workout={live.workout}
          initialVariants={scalingPlan}
          onSubmit={handleSubmitPartialReps}
        />
      ) : null}

      {showScorecard && selfLeaderboardEntry ? (
        <MissionScorecard
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
          nextUpMissionName={continueMissionName ?? nextUpMissionName}
          nextMissionId={nextChainedMissionId}
          missionId={missionId ?? null}
          templateId={live.templateId ?? null}
        />
      ) : null}

      {showMissionLoadingModal ? <MissionLoadingModal onConfirm={dismissMissionLoading} /> : null}

      {missionLockedModal.visible ? (
        <MissionLockedModal workout={live.workout} onDismiss={missionLockedModal.dismiss} />
      ) : null}

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
