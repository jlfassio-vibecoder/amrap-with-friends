import { Link, useParams } from 'react-router-dom';
import { getStoredParticipantId, getStoredClaimToken, getStoredNickname } from '@/lib/sessionIdentity';
import { useLiveAmrapSession } from '@/hooks/useLiveAmrapSession';
import { useParticipantClaim } from '@/hooks/useParticipantClaim';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useSessionChannel } from '@/lib/realtime/useSessionChannel';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { SessionChat } from '@/components/SessionChat';
import { buildParticipantRoster } from '@/lib/sessionSync/buildParticipantRoster';

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
        <p className="text-sm text-red-600">Missing session ID.</p>
        <Link to="/">Back home</Link>
      </main>
    );
  }

  if (!participantId) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-sm text-red-600">
          No participant identity found for this session. Join or create again.
        </p>
        <div className="flex gap-4 text-sm">
          <Link to="/join">Join session</Link>
          <Link to="/create">Create session</Link>
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
  const { isAuthenticated } = useAmrapAuth();

  const channel = useSessionChannel(sessionId, { participantId, nickname });
  const live = useLiveAmrapSession(sessionId, channel);
  const claim = useParticipantClaim(sessionId);

  const showStart = live.isHost && live.phase === 'waiting';
  const showPause = live.isHost && live.phase === 'work' && !live.isPaused;
  const showResume = live.isHost && live.phase === 'work' && live.isPaused;
  const showLogRound = live.phase === 'work' && !live.isPaused;
  const showFinishedClaimPrompt =
    live.phase === 'finished' && claim.showClaimPrompt;

  const hostStatusText = live.isHost
    ? 'You are the host.'
    : 'Waiting on host for session control.';

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 lg:max-w-none lg:space-y-0 lg:p-0 lg:min-h-screen lg:flex lg:flex-col">
      <header className="hidden items-center justify-between gap-4 border-b border-gray-200 bg-white px-8 py-4 lg:flex">
        <Link className="text-lg font-semibold" to="/">
          AMRAP With Friends
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold">Live session</p>
          <p className="text-sm text-gray-600">{hostStatusText}</p>
        </div>
        <AuthHeaderActions />
      </header>

      <div className="flex items-start justify-between gap-4 lg:hidden">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Live session</h1>
          <p className="text-sm text-gray-600">{hostStatusText}</p>
        </div>
        <AuthHeaderActions />
      </div>

      <div className="space-y-6 lg:mx-auto lg:w-full lg:max-w-7xl lg:space-y-4 lg:px-8 lg:pt-6">
        {live.syncError && (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {live.syncError}
          </p>
        )}

        {claim.claimError && (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {claim.claimError}
          </p>
        )}

        {claim.claimMessage && (
          <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            {claim.claimMessage}
          </p>
        )}

        {showFinishedClaimPrompt && (
          <section className="space-y-2 rounded border border-blue-200 bg-blue-50 p-4 text-sm">
            <p className="font-medium">Save your results</p>
            <p className="text-gray-700">
              Sign up is optional, but saving links this session to your account for My Sessions.
            </p>
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={claim.isClaiming}
              onClick={() => claim.saveToAccount()}
            >
              {claim.isClaiming ? 'Saving…' : 'Save this session to my account'}
            </button>
          </section>
        )}

        {claim.showClaimPrompt && live.phase !== 'finished' && (
          <section className="rounded border border-gray-300 p-4 text-sm">
            <button
              type="button"
              className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50"
              disabled={claim.isClaiming}
              onClick={() => claim.saveToAccount()}
            >
              {claim.isClaiming ? 'Saving…' : 'Save this session to my account'}
            </button>
          </section>
        )}
      </div>

      <div className="space-y-6 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:items-stretch lg:gap-6 lg:space-y-0 lg:px-8 lg:py-6 lg:min-h-0">
        <div className="space-y-6 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:space-y-4 lg:self-start lg:rounded-lg lg:border lg:border-gray-300 lg:p-6">
          <section className="space-y-3 rounded border border-gray-300 p-4 text-center lg:border-0 lg:p-0">
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500 lg:text-base">
              {phaseLabel(live.phase)}
            </p>
            <p className="text-5xl font-semibold tabular-nums lg:text-7xl xl:text-8xl">
              {live.phase === 'waiting' ? '—' : formatTime(live.timeLeftSec)}
            </p>
            {live.phase === 'work' || live.phase === 'finished' ? (
              <p className="text-sm text-gray-600">
                Elapsed: {formatTime(live.elapsedSec)}
              </p>
            ) : null}
            <p className="text-xs text-gray-500">
              Realtime: {live.isRealtimeConnected ? 'connected' : 'connecting…'}
            </p>
          </section>

          <section className="flex flex-wrap gap-2 lg:justify-center">
            {showStart && (
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white lg:px-6 lg:py-3 lg:text-base"
                onClick={() => live.start()}
              >
                Start
              </button>
            )}
            {showPause && (
              <button
                type="button"
                className="rounded border border-gray-400 px-4 py-2 text-sm lg:px-6 lg:py-3 lg:text-base"
                onClick={() => live.pause()}
              >
                Pause
              </button>
            )}
            {showResume && (
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white lg:px-6 lg:py-3 lg:text-base"
                onClick={() => live.resume()}
              >
                Resume
              </button>
            )}
            {showLogRound && (
              <button
                type="button"
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white lg:px-6 lg:py-3 lg:text-base"
                onClick={() => live.logRound()}
              >
                Log round
              </button>
            )}
          </section>
        </div>

        <ParticipantsPanel
          roster={buildParticipantRoster(
            live.leaderboard,
            live.presence,
            live.participantId
          )}
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
          <section className="space-y-2 rounded border border-gray-300 p-4 lg:col-start-1 lg:row-start-3 lg:self-start">
            <h2 className="text-sm font-semibold lg:text-lg">Workout</h2>
            <ul className="space-y-1 text-sm lg:space-y-4">
              {live.workout.map((exercise, index) => (
                <li
                  key={`${exercise.name}-${index}`}
                  className="lg:flex lg:items-center lg:gap-4"
                >
                  <span className="hidden lg:flex lg:h-12 lg:w-12 lg:shrink-0 lg:items-center lg:justify-center lg:rounded-full lg:bg-gray-900 lg:text-xl lg:font-semibold lg:text-white">
                    {index + 1}
                  </span>
                  <span className="lg:text-2xl lg:leading-snug xl:text-3xl">
                    {formatExerciseLabel(exercise)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="space-y-2 text-sm text-gray-600 lg:hidden">
        <p>
          <span className="font-medium">Session ID:</span> {live.sessionId}
        </p>
        <p>
          <span className="font-medium">Your nickname:</span> {live.nickname}
        </p>
        <Link to="/">Back home</Link>
      </section>

      <footer className="hidden text-sm text-gray-600 lg:flex lg:items-center lg:justify-between lg:border-t lg:border-gray-200 lg:px-8 lg:py-3">
        <span>
          <span className="font-medium">Session ID:</span> {live.sessionId}
        </span>
        <span>
          <span className="font-medium">Your nickname:</span> {live.nickname}
        </span>
        <Link to="/">Back home</Link>
      </footer>
    </main>
  );
}
