import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { MySessionScoreBreakdownModal } from '@/components/MySessionScoreBreakdownModal';
import { AssignedWorkoutsPanel } from '@/components/session/AssignedWorkoutsPanel';
import { SendWorkoutToSquad } from '@/components/session/SendWorkoutToSquad';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import {
  canDeleteMySession,
  deleteIncompleteSession,
  fetchMySessions,
  formatMySessionScoreDisplay,
  mySessionWorkoutTitle,
  type MySessionEntry,
} from '@/lib/api/mySessions';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

function formatSessionWhen(entry: MySessionEntry): string {
  const when = entry.scheduledAt ?? entry.createdAt;
  return new Date(when).toLocaleString();
}

function formatExerciseLine(exercise: WorkoutExercise): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }
  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

function confirmDeleteMessage(entry: MySessionEntry): string {
  if (entry.isFeatured) {
    return 'Cancel this Featured WOD for this date and time only? Other scheduled days stay on the calendar.';
  }
  return 'Permanently delete this incomplete session?';
}

function MySessionMovements({ workout }: { workout: WorkoutExercise[] }) {
  if (workout.length === 0) {
    return null;
  }

  const summary = workout.length === 1 ? '1 movement' : `${workout.length} movements`;

  return (
    <details className="text-center">
      <summary className="cursor-pointer text-sm text-secondary hover:text-ink">{summary}</summary>
      <ul className="mt-2 space-y-1 text-left text-sm text-secondary">
        {workout.map((exercise, index) => (
          <li key={`${exercise.name}-${index}`}>{formatExerciseLine(exercise)}</li>
        ))}
      </ul>
    </details>
  );
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
      setEntries((prev) => prev.filter((item) => item.sessionId !== entry.sessionId));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeletingSessionId(null);
    }
  }

  return (
    <NarrowPageLayout title="My sessions" subtitle="Saved to your account">
      <p className="text-sm text-secondary lg:hidden">Sessions you saved to your account.</p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">My sessions</h1>
        <p className="text-sm text-secondary">Sessions you saved to your account.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-primary" to="/create">
          Create session
        </Link>
        <Link className="btn-primary" to="/campaign/new">
          New campaign
        </Link>
      </div>

      <AssignedWorkoutsPanel />

      <MyCampaignsPanel showCreateCta={false} />

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-secondary">Sign in to see sessions saved to your account.</p>
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
              <p className="text-display text-center text-lg text-ink">
                {mySessionWorkoutTitle(entry)}
              </p>
              <MySessionMovements workout={entry.workout} />
              <p className="text-center text-secondary">
                {formatSessionWhen(entry)} · {entry.durationMinutes} min ·{' '}
                {formatMySessionScoreDisplay(entry)} · {entry.state}
                {entry.isFeatured ? ' · Featured' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link className="link-accent" to={`/session/${entry.sessionId}`}>
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
                <SendWorkoutToSquad
                  durationMinutes={entry.durationMinutes}
                  workout={entry.workout}
                  templateId={entry.templateId}
                  ready={entry.workout.length > 0}
                  triggerClassName="link-accent font-normal disabled:text-muted"
                  triggerLabel="Send to a squad friend"
                />
                {canDeleteMySession(entry) ? (
                  <button
                    type="button"
                    className="text-error ml-auto"
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
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
