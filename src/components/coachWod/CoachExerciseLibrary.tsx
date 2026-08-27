import { useEffect, useState } from 'react';
import { CoachExerciseForm } from '@/components/coachWod/CoachExerciseForm';
import { CoachExerciseInfoModal } from '@/components/coachWod/CoachExerciseInfoModal';
import {
  cloneCoachExercise,
  deleteCoachExercise,
  fetchCoachExercises,
  type CoachExercise,
} from '@/lib/api/coachWod';

export function CoachExerciseLibrary() {
  const [exercises, setExercises] = useState<CoachExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CoachExercise | 'new' | null>(null);
  const [viewing, setViewing] = useState<CoachExercise | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachExercises().then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setExercises(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSaved(exercise: CoachExercise) {
    setExercises((current) => {
      const withoutSaved = current.filter((entry) => entry.id !== exercise.id);
      return [...withoutSaved, exercise].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(null);
  }

  async function handleDelete(exercise: CoachExercise) {
    const result = await deleteCoachExercise(exercise.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setExercises((current) => current.filter((entry) => entry.id !== exercise.id));
    setViewing((current) => (current?.id === exercise.id ? null : current));
  }

  async function handleDuplicate(exercise: CoachExercise) {
    setDuplicatingId(exercise.id);
    const result = await cloneCoachExercise(exercise.id);
    setDuplicatingId(null);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setError(null);
    handleSaved(result.data);
  }

  if (editing) {
    return (
      <CoachExerciseForm
        exercise={editing === 'new' ? null : editing}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Exercise library</h2>
        <button type="button" className="btn-primary text-sm" onClick={() => setEditing('new')}>
          New exercise
        </button>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading exercises…</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && exercises.length === 0 ? (
        <p className="text-sm text-secondary">
          No custom exercises yet. Add one to attach images, instructions, and cues to movements
          in your workouts.
        </p>
      ) : null}

      {!loading && exercises.length > 0 ? (
        <ul className="divide-y divide-divider">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-semibold text-ink">
                {exercise.name}
                {exercise.isShared ? (
                  <span className="ml-2 rounded-card bg-accent-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Shared
                  </span>
                ) : null}
                {!exercise.isOwner ? (
                  <span className="ml-2 rounded-card border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                    Another coach
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 gap-3 text-xs uppercase tracking-wide">
                <button
                  type="button"
                  className="text-secondary hover:text-ink hover:underline"
                  onClick={() => setViewing(exercise)}
                >
                  View
                </button>
                {exercise.isOwner ? (
                  <button
                    type="button"
                    className="text-secondary hover:text-ink hover:underline"
                    onClick={() => setEditing(exercise)}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-secondary hover:text-ink hover:underline"
                  disabled={duplicatingId === exercise.id}
                  onClick={() => {
                    void handleDuplicate(exercise);
                  }}
                >
                  {duplicatingId === exercise.id ? 'Duplicating…' : 'Duplicate'}
                </button>
                {exercise.isOwner ? (
                  <button
                    type="button"
                    className="text-error hover:underline"
                    onClick={() => {
                      void handleDelete(exercise);
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

      {viewing ? (
        <CoachExerciseInfoModal exercise={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </section>
  );
}
