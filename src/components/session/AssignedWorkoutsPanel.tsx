import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dismissAssignedWorkout,
  fetchMyAssignedWorkouts,
  startAssignedWorkout,
  type AssignedWorkout,
} from '@/lib/api/assignedWorkouts';
import { createSession } from '@/lib/api/sessions';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';

/**
 * Workouts a squad friend put on this athlete's list.
 *
 * my_sessions() answers "what did I train?"; this is the other half — something
 * waiting to be trained. Starting one creates an ordinary session from the
 * stored workout, so from that point on it scores, paces and files itself into
 * history like anything else.
 */
export function AssignedWorkoutsPanel() {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { profile } = useAthleteProfile();
  const [assigned, setAssigned] = useState<AssignedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchMyAssignedWorkouts();
    if (result.error) {
      setError(result.error.message);
      setAssigned([]);
    } else {
      setError(null);
      setAssigned(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    void fetchMyAssignedWorkouts().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
        setAssigned([]);
      } else {
        setError(null);
        setAssigned(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading]);

  async function handleStart(entry: AssignedWorkout) {
    setBusyId(entry.assignedWorkoutId);
    setError(null);
    try {
      const created = await createSession({
        durationMinutes: entry.durationMinutes,
        nickname: profile?.nickname?.trim() || 'Athlete',
        workout: entry.workout,
        templateId: entry.templateId ?? undefined,
        intensityTier: entry.intensityTier ?? undefined,
      });
      if (created.error || !created.data) {
        setError(created.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      // Best effort: the session is real either way, and leaving the row
      // pending is better than blocking the athlete from training.
      // createSession already persists identity (nickname, tokens, claim).
      await startAssignedWorkout(entry.assignedWorkoutId, created.data.sessionId);
      navigate(`/session/${created.data.sessionId}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(entry: AssignedWorkout) {
    setBusyId(entry.assignedWorkoutId);
    setError(null);
    const result = await dismissAssignedWorkout(entry.assignedWorkoutId);
    setBusyId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  if (isAuthLoading || !isAuthenticated) {
    return null;
  }
  // Nothing waiting is the normal case — an empty card every visit is noise.
  if (!loading && !error && assigned.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-display text-xl text-ink">Sent to you</h2>
        <p className="text-sm text-secondary">
          Workouts your squad picked out for you. Starting one runs it like any other session.
        </p>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
      {error ? <p className="alert-error">{error}</p> : null}

      {assigned.length > 0 ? (
        <ul className="divide-y divide-divider">
          {assigned.map((entry) => {
            const busy = busyId === entry.assignedWorkoutId;
            return (
              <li key={entry.assignedWorkoutId} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-semibold text-ink">From {entry.fromNickname}</span>
                  <span className="text-xs text-secondary">{entry.durationMinutes} min</span>
                </div>
                <p className="text-sm text-secondary">
                  {entry.workout.map((movement) => movement.name).join(' · ')}
                </p>
                {entry.note ? <p className="text-sm text-muted">“{entry.note}”</p> : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busy}
                    onClick={() => void handleStart(entry)}
                  >
                    {busy ? 'Starting…' : 'Start it'}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-secondary hover:text-ink"
                    disabled={busy}
                    onClick={() => void handleDismiss(entry)}
                  >
                    Not now
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
