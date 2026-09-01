import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { MyMissionScoreBreakdownModal } from '@/components/MyMissionScoreBreakdownModal';
import { AssignedWorkoutsPanel } from '@/components/mission/AssignedWorkoutsPanel';
import { SendWorkoutToSquad } from '@/components/mission/SendWorkoutToSquad';
import { MyCampaignsPanel } from '@/components/campaign/MyCampaignsPanel';
import {
  canDeleteMyMission,
  deleteIncompleteMission,
  fetchMyMissions,
  formatMyMissionScoreDisplay,
  myMissionWorkoutTitle,
  type MyMissionEntry,
} from '@/lib/api/myMissions';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

function formatMissionWhen(entry: MyMissionEntry): string {
  const when = entry.scheduledAt ?? entry.createdAt;
  return new Date(when).toLocaleString();
}

function formatExerciseLine(exercise: WorkoutExercise): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }
  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

function confirmDeleteMessage(entry: MyMissionEntry): string {
  if (entry.isFeatured) {
    return 'Cancel this Featured WOD for this date and time only? Other scheduled days stay on the calendar.';
  }
  return 'Permanently delete this incomplete mission?';
}

function MyMissionMovements({ workout }: { workout: WorkoutExercise[] }) {
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

export default function MyMissionsPage() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [entries, setEntries] = useState<MyMissionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [breakdownEntry, setBreakdownEntry] = useState<MyMissionEntry | null>(null);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchMyMissions().then((result) => {
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

  async function handleDelete(entry: MyMissionEntry) {
    if (!canDeleteMyMission(entry) || deletingMissionId) {
      return;
    }
    const confirmed = window.confirm(confirmDeleteMessage(entry));
    if (!confirmed) {
      return;
    }

    setDeletingMissionId(entry.missionId);
    setError(null);
    try {
      const result = await deleteIncompleteMission(entry.missionId);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setEntries((prev) => prev.filter((item) => item.missionId !== entry.missionId));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDeletingMissionId(null);
    }
  }

  return (
    <NarrowPageLayout title="My missions" subtitle="Saved to your account">
      <p className="text-sm text-secondary lg:hidden">Missions you saved to your account.</p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">My missions</h1>
        <p className="text-sm text-secondary">Missions you saved to your account.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link className="btn-primary" to="/create">
          Create mission
        </Link>
        <Link className="btn-primary" to="/campaign/new">
          New campaign
        </Link>
      </div>

      <AssignedWorkoutsPanel />

      <MyCampaignsPanel showCreateCta={false} />

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-secondary">Sign in to see missions saved to your account.</p>
      ) : null}

      {error && <p className="text-error">Error: {error}</p>}

      {!loading && isAuthenticated && entries.length === 0 ? (
        <p className="text-sm text-secondary">
          No saved missions yet. Finish a mission and use “Save this mission to my account”.
        </p>
      ) : null}

      {entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.participantId} className="card space-y-2 p-4 text-sm">
              <p className="text-display text-center text-lg text-ink">
                {myMissionWorkoutTitle(entry)}
              </p>
              <MyMissionMovements workout={entry.workout} />
              <p className="text-center text-secondary">
                {formatMissionWhen(entry)} · {entry.durationMinutes} min ·{' '}
                {formatMyMissionScoreDisplay(entry)} · {entry.state}
                {entry.isFeatured ? ' · Featured' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link className="link-accent" to={`/mission/${entry.missionId}`}>
                  View mission
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
                {canDeleteMyMission(entry) ? (
                  <button
                    type="button"
                    className="text-error ml-auto"
                    disabled={deletingMissionId === entry.missionId}
                    onClick={() => void handleDelete(entry)}
                  >
                    {deletingMissionId === entry.missionId ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {breakdownEntry ? (
        <MyMissionScoreBreakdownModal
          entry={breakdownEntry}
          onClose={() => setBreakdownEntry(null)}
        />
      ) : null}

      <p className="text-center text-sm">
        <AppLink className="link-accent" to="/">
          Back home
        </AppLink>
      </p>
    </NarrowPageLayout>
  );
}
