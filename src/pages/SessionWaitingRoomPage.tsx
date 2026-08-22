import { Link, useParams } from 'react-router-dom';
import {
  getStoredNickname,
  getStoredParticipantId,
} from '@/lib/sessionIdentity';

export default function SessionWaitingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nickname = sessionId ? getStoredNickname(sessionId) : null;
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

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Waiting room</h1>
        <p className="text-sm text-gray-600">Waiting for host to start the session.</p>
      </div>

      <section className="space-y-2 rounded border border-gray-300 p-4 text-sm">
        <p><span className="font-medium">Session ID:</span> {sessionId}</p>
        <p><span className="font-medium">Your nickname:</span> {nickname ?? 'Unknown'}</p>
      </section>

      <p className="text-sm text-gray-600">
        Live countdown and participant sync arrive in a later update.
      </p>

      <Link className="text-sm" to="/">Back home</Link>
    </main>
  );
}
