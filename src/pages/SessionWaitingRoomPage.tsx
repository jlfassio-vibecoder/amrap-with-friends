import { Link, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getStoredParticipantId, getStoredClaimToken, getStoredNickname, getStoredGhostSelection } from '@/lib/sessionIdentity';
import { useLiveAmrapSession } from '@/hooks/useLiveAmrapSession';
import { useParticipantClaim } from '@/hooks/useParticipantClaim';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useSessionChannel } from '@/lib/realtime/useSessionChannel';
import { canOfferSessionSave } from '@/lib/claim/canOfferSessionSave';
import { AppHeader } from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import { ExerciseInfoTrigger } from '@/components/exerciseInfo/ExerciseInfoTrigger';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { PartialRepsModal } from '@/components/PartialRepsModal';
import { SessionScorecard, type SessionScorecardSaveState } from '@/components/SessionScorecard';
import { SessionChat } from '@/components/SessionChat';
import { GhostPicker } from '@/components/GhostPicker';
import { GhostPacerStrip } from '@/components/GhostPacerStrip';
import { useGhostPacer } from '@/hooks/useGhostPacer';
import type { StoredGhostSelection } from '@/lib/sessionIdentity';

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
      return 'Work';
    case 'finished':
      return 'Finished';
    default:
      return phase;
  }
}

function formatExerciseLabel(exercise: {
  name: string;
  target?: number;
  unit?: string;
}): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }

  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

export default function SessionWaitingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const participantId = sessionId ? getStoredParticipantId(sessionId) : null;

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-error">Error: Missing session ID.</p>
        <Link className="link-accent" to="/">Back home</Link>
      </main>
    );
  }

  if (!participantId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-error">
          Error: No participant identity found for this session. Join or create again.
        </p>
        <div className="flex gap-4 text-sm">
          <Link className="link-accent" to="/join">Join session</Link>
          <Link className="link-accent" to="/create">Create session</Link>
        </div>
      </main>
    );
  }

  return <LiveSessionView sessionId={sessionId} />;
}

function LiveSessionView({ sessionId }: { sessionId: string }) {
  const participantId = getStoredParticipantId(sessionId) ?? '';
  const nickname = getStoredNickname(sessionId) ?? 'Unknown';
  const claimToken = getStoredClaimToken(sessionId);
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [isSubmittingPartialReps, setIsSubmittingPartialReps] = useState(false);
  const [scorecardDismissed, setScorecardDismissed] = useState(false);
  const [authOpenForSave, setAuthOpenForSave] = useState(false);
  const pendingSaveAfterAuth = useRef(false);
  const [ghostSelection, setGhostSelection] = useState<StoredGhostSelection | null>(
    () => getStoredGhostSelection(sessionId)
  );
  // Copilot suggestion ignored: activeGhostSelection already gates stored selection on isAuthenticated.
  const activeGhostSelection = isAuthenticated ? ghostSelection : null;

  const channel = useSessionChannel(sessionId, { participantId, nickname });
  const live = useLiveAmrapSession(sessionId, channel);
  const claim = useParticipantClaim(sessionId);
  const selfLeaderboardEntry =
    live.leaderboard.find((entry) => entry.isSelf) ?? null;
  const selfBaseScore = selfLeaderboardEntry?.baseScore ?? 0;

  const ghostPacer = useGhostPacer({
    sessionId,
    ghostSelection: activeGhostSelection,
    repsPerRound: live.repsPerRound,
    workDurationSec: live.workDurationSec,
    elapsedSec: live.elapsedSec,
    selfBaseScore,
  });

  const isSoloTemplated =
    live.participantCount === 1 &&
    live.templateId !== null &&
    live.phase === 'waiting';
  const showGhostPicker = isSoloTemplated;
  // Copilot suggestion ignored: ghost pacer error display and strip suppression on load failure already exist.
  const showGhostPacerError =
    activeGhostSelection !== null && live.phase === 'work' && ghostPacer.error !== null;
  const showGhostPacerStrip =
    activeGhostSelection !== null &&
    live.phase === 'work' &&
    ghostPacer.error === null &&
    !ghostPacer.isLoading;

  const showStart = live.isHost && live.phase === 'waiting';
  const showPause = live.isHost && live.phase === 'work' && !live.isPaused;
  const showResume = live.isHost && live.phase === 'work' && live.isPaused;
  const showLogRound = live.phase === 'work' && !live.isPaused;
  const showPartialRepsModal =
    live.phase === 'finished' &&
    live.repsPerRound > 0 &&
    !live.hasSubmittedPartialReps;
  const showScorecard =
    live.phase === 'finished' &&
    live.hasSubmittedPartialReps &&
    !scorecardDismissed &&
    selfLeaderboardEntry !== null;
  const showFinishedClaimPrompt =
    live.phase === 'finished' &&
    claim.showClaimPrompt &&
    !showPartialRepsModal &&
    !showScorecard;

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
  }, [isAuthLoading, isAuthenticated, canSave, claim.isClaiming]);

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

  const hostStatusText = live.isHost
    ? 'You are the host.'
    : 'Waiting on host for session control.';

  return (
    <main className="mx-auto max-w-lg space-y-6 bg-page px-6 pb-6 pt-0 lg:max-w-none lg:space-y-0 lg:p-0 lg:min-h-screen lg:flex lg:flex-col">
      <div inert={showPartialRepsModal || undefined}>
        <AppHeader
          title="Live session"
          subtitle={hostStatusText}
          desktopTitleAsPageHeading
        />

        <div className="space-y-6 px-6 pb-6 pt-0 lg:mx-auto lg:w-full lg:max-w-7xl lg:space-y-4 lg:px-8 lg:pt-6 lg:pb-0">
          {live.syncError && (
            <p className="alert-error">{live.syncError}</p>
          )}

          {claim.claimError && (
            <p className="alert-error">{claim.claimError}</p>
          )}

          {claim.claimMessage && (
            <p className="alert-success">{claim.claimMessage}</p>
          )}

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

        <div className="space-y-6 px-6 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 lg:px-8 lg:py-6 lg:min-h-0">
          <div className="space-y-6 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:space-y-4 lg:self-start lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-6 lg:shadow-card">
            <section className="card space-y-3 p-4 text-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <p className="text-display text-sm text-secondary lg:text-base">
                {phaseLabel(live.phase)}
              </p>
              <p className="text-display text-accent tabular-nums text-5xl lg:text-7xl xl:text-8xl">
                {live.phase === 'waiting' ? '—' : formatTime(live.timeLeftSec)}
              </p>
              {live.phase === 'work' || live.phase === 'finished' ? (
                <p className="text-sm text-secondary">
                  Elapsed: {formatTime(live.elapsedSec)}
                </p>
              ) : null}
              <p className="text-xs text-muted">
                Realtime: {live.isRealtimeConnected ? 'connected' : 'connecting…'}
              </p>
            </section>

            {showGhostPicker && live.templateId ? (
              <GhostPicker
                sessionId={sessionId}
                templateId={live.templateId}
                durationMinutes={live.workDurationSec / 60}
                value={ghostSelection}
                onChange={setGhostSelection}
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

            <section className="flex flex-wrap gap-2 lg:justify-center">
              {showStart && (
                <button
                  type="button"
                  className="btn-primary lg:px-6 lg:py-3 lg:text-base"
                  onClick={() => live.start()}
                >
                  Start
                </button>
              )}
              {showPause && (
                <button
                  type="button"
                  className="btn-outline lg:px-6 lg:py-3 lg:text-base"
                  onClick={() => live.pause()}
                >
                  Pause
                </button>
              )}
              {showResume && (
                <button
                  type="button"
                  className="btn-primary lg:px-6 lg:py-3 lg:text-base"
                  onClick={() => live.resume()}
                >
                  Resume
                </button>
              )}
              {showLogRound && (
                <button
                  type="button"
                  className="btn-success lg:px-6 lg:py-3 lg:text-base"
                  onClick={() => live.logRound()}
                >
                  Log round
                </button>
              )}
            </section>
          </div>

          <ParticipantsPanel
            leaderboard={live.leaderboard}
            presence={live.presence}
            selfParticipantId={live.participantId}
            phase={live.phase}
            className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start"
          />

          <SessionChat
            sessionId={sessionId}
            participantId={participantId}
            claimToken={claimToken}
            isAuthenticated={isAuthenticated}
            messages={channel.messages}
            className="lg:col-start-2 lg:row-start-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:self-stretch"
          />

          {live.workout.length > 0 && (
            <section className="card space-y-2 p-4 lg:col-start-1 lg:row-start-3 lg:self-start">
              <h2 className="text-display text-sm text-ink lg:text-lg">Workout</h2>
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
        </div>

        <section className="space-y-2 px-6 pb-6 text-sm text-secondary lg:hidden">
          <p>
            <span className="font-semibold text-ink">Session ID:</span> {live.sessionId}
          </p>
          <p>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </p>
          <Link className="link-accent" to="/">Back home</Link>
        </section>

        <footer className="hidden border-t border-divider bg-surface text-sm text-secondary lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-3">
          <span>
            <span className="font-semibold text-ink">Session ID:</span> {live.sessionId}
          </span>
          <span>
            <span className="font-semibold text-ink">Your nickname:</span> {live.nickname}
          </span>
          <Link className="link-accent" to="/">Back home</Link>
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
        />
      ) : null}

      {authOpenForSave ? <AuthModal onClose={handleAuthCloseForSave} /> : null}
    </main>
  );
}
