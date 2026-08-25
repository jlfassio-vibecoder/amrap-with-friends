import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { EditRallyScheduleForm } from '@/components/session/EditRallyScheduleForm';
import {
  fetchHostScheduledSessions,
  formatHostScheduledSessionRallyTime,
  formatHostScheduledSessionState,
  formatHostScheduledSessionWorkout,
  type HostScheduledSessionEntry,
} from '@/lib/api/hostScheduledSessions';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

export function HostScheduledSessionsPanel() {
  const { isAuthenticated, isAuthLoading, user } = useAmrapAuth();
  const [entries, setEntries] = useState<HostScheduledSessionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const result = await fetchHostScheduledSessions();
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setEntries(result.data ?? []);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    void loadEntries();
  }, [isAuthLoading, isAuthenticated, user, loadEntries]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && isLoadingEntries);

  async function handleSaved(sessionId: string, scheduledAt: string) {
    setEditingSessionId(null);
    setEntries((prev) =>
      prev.map((entry) =>
        entry.sessionId === sessionId ? { ...entry, scheduledAt } : entry
      )
    );
    await loadEntries();
  }

  return (
    <section className="w-full space-y-3 text-left">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Scheduled rallies
        </h2>
        <p className="text-sm text-secondary">
          Return to a lobby you scheduled for later.
        </p>
      </div>

      {!isAuthLoading && !isAuthenticated ? (
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-secondary">Sign in to see your scheduled rallies.</p>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-secondary">Loading scheduled sessions…</p> : null}

      {error ? <p className="text-error">Error: {error}</p> : null}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-secondary">
          No scheduled sessions. Create one and choose Schedule staging.
        </p>
      ) : null}

      {entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.sessionId} className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">
                {formatHostScheduledSessionWorkout(entry.workout)}
              </p>
              <p className="text-secondary">
                Rally time: {formatHostScheduledSessionRallyTime(entry.scheduledAt)} ·{' '}
                {entry.durationMinutes} min · {formatHostScheduledSessionState(entry.state)}
              </p>
              {editingSessionId === entry.sessionId ? (
                <EditRallyScheduleForm
                  key={entry.scheduledAt}
                  sessionId={entry.sessionId}
                  scheduledAt={entry.scheduledAt}
                  onCancel={() => setEditingSessionId(null)}
                  onSaved={(scheduledAt) => void handleSaved(entry.sessionId, scheduledAt)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="link-accent"
                    to={`/session/${entry.sessionId}`}
                  >
                    Enter staging area
                  </Link>
                  <button
                    type="button"
                    className="link-accent"
                    onClick={() => setEditingSessionId(entry.sessionId)}
                  >
                    Edit time
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {isAuthenticated && !loading ? (
        <p className="text-sm">
          <Link className="link-accent" to="/my-sessions">
            All my sessions
          </Link>
        </p>
      ) : null}

      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}
