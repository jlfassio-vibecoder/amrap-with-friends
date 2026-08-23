import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMySessions, type MySessionEntry } from '@/lib/api/mySessions';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { AuthHeaderActions } from '@/components/AuthHeaderActions';

function formatWorkoutSummary(workout: MySessionEntry['workout']): string {
  if (workout.length === 0) {
    return 'Workout';
  }
  const first = workout[0].name;
  if (workout.length === 1) {
    return first;
  }
  return `${first} + ${workout.length - 1} more`;
}

export default function MySessionsPage() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [entries, setEntries] = useState<MySessionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchMySessions().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
      } else {
        setEntries(result.data ?? []);
      }
      setHasLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user?.id]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">My sessions</h1>
          <p className="text-sm text-gray-600">
            Sessions you saved to your account.
          </p>
        </div>
        <AuthHeaderActions />
      </div>

      {loading ? <p className="text-sm text-gray-600">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-gray-600">
          Sign in to see sessions saved to your account.
        </p>
      ) : null}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-gray-600">
          No saved sessions yet. Finish a session and use “Save this session to my account”.
        </p>
      ) : null}

      {entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.participantId}
              className="space-y-1 rounded border border-gray-300 p-4 text-sm"
            >
              <p className="font-medium">{formatWorkoutSummary(entry.workout)}</p>
              <p className="text-gray-600">
                {new Date(entry.createdAt).toLocaleString()} · {entry.durationMinutes} min ·{' '}
                {entry.roundCount} rounds · {entry.state}
              </p>
              <Link className="underline" to={`/session/${entry.sessionId}`}>
                View session
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="text-sm" to="/">Back home</Link>
    </main>
  );
}
