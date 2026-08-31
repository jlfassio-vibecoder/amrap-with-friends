import { useEffect, useMemo, useState } from 'react';
import {
  cloneCoachWorkout,
  deleteCoachWorkout,
  fetchCoachWorkouts,
  type CoachWorkout,
  type CoachWorkoutSummary,
} from '@/lib/api/coachWod';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

interface CoachWorkoutListProps {
  onSelect: (workout: CoachWorkoutSummary) => void;
  onCreateNew: () => void;
  onDuplicated: (workout: CoachWorkout) => void;
  refreshKey: number;
}

export function CoachWorkoutList({
  onSelect,
  onCreateNew,
  onDuplicated,
  refreshKey,
}: CoachWorkoutListProps) {
  const [workouts, setWorkouts] = useState<CoachWorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachWorkouts({}).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setWorkouts(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const workout of workouts) {
      for (const tag of workout.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }, [workouts]);

  const visibleWorkouts = activeTag ? workouts.filter((w) => w.tags.includes(activeTag)) : workouts;

  async function handleDelete(workout: CoachWorkoutSummary) {
    const result = await deleteCoachWorkout(workout.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setWorkouts((current) => current.filter((entry) => entry.id !== workout.id));
  }

  async function handleDuplicate(workout: CoachWorkoutSummary) {
    setDuplicatingId(workout.id);
    const result = await cloneCoachWorkout(workout.id);
    setDuplicatingId(null);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setError(null);
    onDuplicated(result.data);
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Coach workouts</h2>
        <button type="button" className="btn-primary text-sm" onClick={onCreateNew}>
          New workout
        </button>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={activeTag === null ? 'btn-primary text-xs' : 'btn-outline text-xs'}
            onClick={() => setActiveTag(null)}
          >
            All tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={activeTag === tag ? 'btn-primary text-xs' : 'btn-outline text-xs'}
              onClick={() => setActiveTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-secondary">Loading workouts…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && visibleWorkouts.length === 0 ? (
        <p className="text-sm text-secondary">
          {workouts.length === 0
            ? 'No coach workouts yet. Build your first WOD.'
            : 'No workouts with that tag.'}
        </p>
      ) : null}

      {!loading && visibleWorkouts.length > 0 ? (
        <ul className="divide-y divide-divider">
          {visibleWorkouts.map((workout) => (
            <li key={workout.id} className="flex items-center justify-between gap-3 py-3">
              <button type="button" className="min-w-0 text-left" onClick={() => onSelect(workout)}>
                <p className="truncate text-sm font-semibold text-ink hover:text-accent hover:underline">
                  {workout.name}
                  {workout.status === 'published' ? (
                    <span className="ml-2 rounded-card bg-success-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-text">
                      Published
                    </span>
                  ) : null}
                  {workout.isLocked ? (
                    <span
                      className="ml-2 rounded-card border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary"
                      title="Locked — has a completed mission"
                    >
                      Locked
                    </span>
                  ) : null}
                  {workout.isShared ? (
                    <span className="ml-2 rounded-card bg-accent-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Shared
                    </span>
                  ) : null}
                  {!workout.isOwner ? (
                    <span className="ml-2 rounded-card border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                      Another coach
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-secondary">
                  {workout.durationMinutes}m ·{' '}
                  {INTENSITY_LABEL[workout.intensityTier] ?? workout.intensityTier} ·{' '}
                  {workout.movementCount} movement{workout.movementCount === 1 ? '' : 's'}
                  {workout.tags.length > 0 ? ` · ${workout.tags.join(', ')}` : ''}
                </p>
              </button>
              <span className="flex shrink-0 items-center gap-3 text-xs uppercase tracking-wide">
                <button
                  type="button"
                  className="text-secondary hover:text-ink hover:underline"
                  disabled={duplicatingId === workout.id}
                  onClick={() => {
                    void handleDuplicate(workout);
                  }}
                >
                  {duplicatingId === workout.id ? 'Duplicating…' : 'Duplicate'}
                </button>
                {workout.isOwner ? (
                  <button
                    type="button"
                    className="text-error hover:underline"
                    onClick={() => {
                      void handleDelete(workout);
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
