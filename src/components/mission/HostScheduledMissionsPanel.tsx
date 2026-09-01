import { useCallback, useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { AuthModal } from '@/components/AuthModal';
import { EditRallyScheduleForm } from '@/components/mission/EditRallyScheduleForm';
import {
  fetchHostScheduledMissions,
  formatHostScheduledMissionRallyTime,
  formatHostScheduledMissionState,
  formatHostScheduledMissionWorkout,
  type HostScheduledMissionEntry,
} from '@/lib/api/hostScheduledMissions';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

export function HostScheduledMissionsPanel() {
  const { isAuthenticated, isAuthLoading, user, session } = useAmrapAuth();
  const [entries, setEntries] = useState<HostScheduledMissionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

  const loadEntries = useCallback(async (shouldApply: () => boolean = () => true) => {
    setIsLoadingEntries(true);
    try {
      const result = await fetchHostScheduledMissions();
      if (!shouldApply()) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setEntries(result.data ?? []);
    } finally {
      if (shouldApply()) {
        setIsLoadingEntries(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user || !session?.access_token) {
      setEntries([]);
      setError(null);
      setEditingMissionId(null);
      setIsLoadingEntries(false);
      return;
    }

    let cancelled = false;

    void loadEntries(() => !cancelled);

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user, session?.access_token, loadEntries]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && isLoadingEntries);

  async function handleSaved(missionId: string, scheduledAt: string) {
    setEditingMissionId(null);
    setEntries((prev) =>
      prev.map((entry) => (entry.missionId === missionId ? { ...entry, scheduledAt } : entry))
    );
    await loadEntries();
  }

  return (
    <section className="w-full space-y-3 text-left">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Scheduled missions
        </h2>
        <p className="text-sm text-secondary">Return to a mission you scheduled for later.</p>
      </div>

      {!isAuthLoading && !isAuthenticated ? (
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-secondary">Sign in to see your scheduled missions.</p>
          <button type="button" className="btn-outline" onClick={() => setAuthOpen(true)}>
            Sign in
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-secondary">Loading scheduled missions…</p> : null}

      {isAuthenticated && !loading && error ? <p className="text-error">Error: {error}</p> : null}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-secondary">
          No scheduled missions. Create one and choose Schedule rally point.
        </p>
      ) : null}

      {isAuthenticated && !loading && entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.missionId} className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">{formatHostScheduledMissionWorkout(entry.workout)}</p>
              <p className="text-secondary">
                Rally time: {formatHostScheduledMissionRallyTime(entry.scheduledAt)} ·{' '}
                {entry.durationMinutes} min · {formatHostScheduledMissionState(entry.state)}
              </p>
              {editingMissionId === entry.missionId ? (
                <EditRallyScheduleForm
                  key={entry.scheduledAt}
                  missionId={entry.missionId}
                  scheduledAt={entry.scheduledAt}
                  onCancel={() => setEditingMissionId(null)}
                  onSaved={(scheduledAt) => void handleSaved(entry.missionId, scheduledAt)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <AppLink className="link-accent" to={`/mission/${entry.missionId}`}>
                    Enter mission
                  </AppLink>
                  <button
                    type="button"
                    className="link-accent"
                    onClick={() => setEditingMissionId(entry.missionId)}
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
          <AppLink className="link-accent" to="/my-missions">
            All my missions
          </AppLink>
        </p>
      ) : null}

      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}
