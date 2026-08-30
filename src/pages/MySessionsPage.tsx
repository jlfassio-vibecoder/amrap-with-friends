import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { MySessionScoreBreakdownModal } from '@/components/MySessionScoreBreakdownModal';
import {
  canDeleteMySession,
  deleteIncompleteSession,
  fetchMySessions,
  formatMySessionScoreDisplay,
  type MySessionEntry,
} from '@/lib/api/mySessions';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

function formatWorkoutSummary(entry: MySessionEntry): string {
  if (entry.coachWorkoutName) {
    return entry.coachWorkoutName;
  }
  const workout = entry.workout;
  if (workout.length === 0) {
    return 'Workout';
  }
  const first = workout[0].name;
  if (workout.length === 1) {
    return first;
  }
  return `${first} + ${workout.length - 1} more`;
}

function formatSessionWhen(entry: MySessionEntry): string {
  const when = entry.scheduledAt ?? entry.createdAt;
  return new Date(when).toLocaleString();
}

function confirmDeleteMessage(entry: MySessionEntry): string {
  if (entry.isFeatured) {
    return 'Cancel this Featured WOD for this date and time only? Other scheduled days stay on the calendar.';
  }
  return 'Permanently delete this incomplete session?';
}

export default function MySessionsPage() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [entries, setEntries] = useState<MySessionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [breakdownEntry, setBreakdownEntry] = useState<MySessionEntry | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

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
  }, [isAuthLoading, isAuthenticated, user]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

  async function handleDelete(entry: MySessionEntry) {
    if (!canDeleteMySession(entry) || deletingSessionId) {
      return;
    }
    const confirmed = window.confirm(confirmDeleteMessage(entry));
    if (!confirmed) {
      return;
    }

    setDeletingSessionId(entry.sessionId);
    setError(null);
    try {
      const result = await deleteIncompleteSession(entry.sessionId);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setEntries((prev) =>
        prev.filter((item) => item.sessionId !== entry.sessionId)
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeletingSessionId(null);
    }
  }

  return (
    <NarrowPageLayout title="My sessions" subtitle="Saved to your account">
      <p className="text-sm text-secondary lg:hidden">
        Sessions you saved to your account.
      </p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">My sessions</h1>
        <p className="text-sm text-secondary">
          Sessions you saved to your account.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-primary" to="/create">
          Create session
        </Link>
        <Link className="btn-primary" to="/campaign/new">
          New campaign
        </Link>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-secondary">
          Sign in to see sessions saved to your account.
        </p>
      ) : null}

      {error && <p className="text-error">Error: {error}</p>}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-secondary">
          No saved sessions yet. Finish a session and use “Save this session to my account”.
        </p>
      ) : null}

      {entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.participantId} className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">{formatWorkoutSummary(entry)}</p>
              <p className="text-secondary">
                {formatSessionWhen(entry)} · {entry.durationMinutes} min ·{' '}
                {formatMySessionScoreDisplay(entry)} · {entry.state}
                {entry.isFeatured ? ' · Featured' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  className="link-accent"
                  to={`/session/${entry.sessionId}`}
                >
                  View session
                </Link>
                {entry.scoreBreakdown ? (
                  <button
                    type="button"
                    className="link-accent"
                    onClick={() => setBreakdownEntry(entry)}
                  >
                    View breakdown
                  </button>
                ) : null}
                {canDeleteMySession(entry) ? (
                  <button
                    type="button"
                    className="text-error"
                    disabled={deletingSessionId === entry.sessionId}
                    onClick={() => void handleDelete(entry)}
                  >
                    {deletingSessionId === entry.sessionId ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {breakdownEntry ? (
        <MySessionScoreBreakdownModal
          entry={breakdownEntry}
          onClose={() => setBreakdownEntry(null)}
        />
      ) : null}

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">Back home</Link>
      </p>
    </NarrowPageLayout>
  );
}
