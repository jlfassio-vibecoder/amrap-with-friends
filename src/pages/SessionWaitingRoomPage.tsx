import { Link, useParams } from 'react-router-dom';
import { getStoredParticipantId } from '@/lib/sessionIdentity';
import { useLiveAmrapSession } from '@/hooks/useLiveAmrapSession';
import { useParticipantClaim } from '@/hooks/useParticipantClaim';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';

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
  const live = useLiveAmrapSession(sessionId);
  const claim = useParticipantClaim(sessionId);

  const showStart = live.isHost && live.phase === 'waiting';
  const showPause = live.isHost && live.phase === 'work' && !live.isPaused;
  const showResume = live.isHost && live.phase === 'work' && live.isPaused;
  const showLogRound = live.phase === 'work' && !live.isPaused;
  const showFinishedClaimPrompt =
    live.phase === 'finished' && claim.showClaimPrompt;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Live session</h1>
          <p className="text-sm text-gray-600">
            {live.isHost ? 'You are the host.' : 'Waiting on host for session control.'}
          </p>
        </div>
        <AuthHeaderActions />
      </div>

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

      <section className="space-y-3 rounded border border-gray-300 p-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {phaseLabel(live.phase)}
        </p>
        <p className="text-5xl font-semibold tabular-nums">
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

      <section className="flex flex-wrap gap-2">
        {showStart && (
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => live.start()}
          >
            Start
          </button>
        )}
        {showPause && (
          <button
            type="button"
            className="rounded border border-gray-400 px-4 py-2 text-sm"
            onClick={() => live.pause()}
          >
            Pause
          </button>
        )}
        {showResume && (
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => live.resume()}
          >
            Resume
          </button>
        )}
        {showLogRound && (
          <button
            type="button"
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => live.logRound()}
          >
            Log round
          </button>
        )}
      </section>

      <section className="space-y-2 rounded border border-gray-300 p-4">
        <h2 className="text-sm font-semibold">Leaderboard</h2>
        {live.leaderboard.length === 0 ? (
          <p className="text-sm text-gray-600">No rounds logged yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {live.leaderboard.map((entry) => (
              <li key={entry.participantId} className="flex justify-between">
                <span>
                  {entry.nickname}
                  {entry.isSelf ? ' (you)' : ''}
                </span>
                <span className="font-medium tabular-nums">{entry.roundCount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded border border-gray-300 p-4">
        <h2 className="text-sm font-semibold">Who&apos;s here</h2>
        <ul className="space-y-1 text-sm">
          {live.presence.map((entry) => (
            <li key={entry.participantId} className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  entry.isOnline ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-hidden
              />
              <span>
                {entry.nickname}
                {entry.participantId === live.participantId ? ' (you)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {live.workout.length > 0 && (
        <section className="space-y-2 rounded border border-gray-300 p-4">
          <h2 className="text-sm font-semibold">Workout</h2>
          <ul className="space-y-1 text-sm">
            {live.workout.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>
                {exercise.name}
                {exercise.target !== undefined
                  ? ` — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`
                  : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm text-gray-600">
        <p>
          <span className="font-medium">Session ID:</span> {live.sessionId}
        </p>
        <p>
          <span className="font-medium">Your nickname:</span> {live.nickname}
        </p>
      </section>

      <Link className="text-sm" to="/">Back home</Link>
    </main>
  );
}
