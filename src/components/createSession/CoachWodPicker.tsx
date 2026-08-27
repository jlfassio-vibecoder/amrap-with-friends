import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedCoachWorkouts, type PublishedCoachWorkout } from '@/lib/api/coachWod';
import { getCoachExerciseMediaUrl } from '@/lib/media/coachExerciseMedia';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

interface CoachWodCardProps {
  workout: PublishedCoachWorkout;
  selected: boolean;
  onSelect: (workout: PublishedCoachWorkout) => void;
}

function CoachWodCard({ workout, selected, onSelect }: CoachWodCardProps) {
  const [expandedMovement, setExpandedMovement] = useState<number | null>(null);

  return (
    <div
      className={
        selected
          ? 'space-y-3 rounded-card border-2 border-accent bg-accent-tint/40 p-4'
          : 'space-y-3 rounded-card border border-border bg-surface p-4'
      }
    >
      <button type="button" className="block w-full text-left" onClick={() => onSelect(workout)}>
        <p className="text-sm font-semibold text-ink">{workout.name}</p>
        {workout.focus ? <p className="text-xs text-secondary">{workout.focus}</p> : null}
        <p className="mt-1 text-xs text-secondary">
          {workout.durationMinutes}m ·{' '}
          {INTENSITY_LABEL[workout.intensityTier] ?? workout.intensityTier}
          {workout.tags.length > 0 ? ` · ${workout.tags.join(', ')}` : ''}
        </p>
      </button>

      <ul className="space-y-1 text-xs text-secondary">
        {workout.movements.map((movement, index) => (
          <li key={index}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink">
                {movement.target ? `${movement.target} ` : ''}
                {movement.name}
                {movement.unit && movement.unit !== 'reps' ? ` ${movement.unit}` : ''}
              </span>
              {movement.exercise ? (
                <button
                  type="button"
                  className="shrink-0 text-accent hover:underline"
                  onClick={() =>
                    setExpandedMovement((current) => (current === index ? null : index))
                  }
                >
                  {expandedMovement === index ? 'Hide' : 'How to'}
                </button>
              ) : null}
            </div>
            {expandedMovement === index && movement.exercise ? (
              <div className="mt-1 space-y-1 rounded-card border border-border bg-page p-2">
                {movement.exercise.imagePath ? (
                  <img
                    src={getCoachExerciseMediaUrl(movement.exercise.imagePath)}
                    alt={movement.exercise.name}
                    className="h-24 w-24 rounded-card border border-border object-cover"
                  />
                ) : null}
                {movement.exercise.instructions.length > 0 ? (
                  <ol className="list-decimal space-y-0.5 pl-4 text-ink">
                    {movement.exercise.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : null}
                {movement.exercise.cues.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {movement.exercise.cues.map((cue, i) => (
                      <li key={i}>{cue}</li>
                    ))}
                  </ul>
                ) : null}
                {movement.exercise.tips ? (
                  <p className="italic">{movement.exercise.tips}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CoachWodPickerProps {
  selectedWorkoutId: string | null;
  onSelect: (workout: PublishedCoachWorkout) => void;
}

export function CoachWodPicker({ selectedWorkoutId, onSelect }: CoachWodPickerProps) {
  const [workouts, setWorkouts] = useState<PublishedCoachWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedCoachWorkouts({}).then((result) => {
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
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const workout of workouts) {
      for (const tag of workout.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }, [workouts]);

  const visibleWorkouts = activeTag
    ? workouts.filter((w) => w.tags.includes(activeTag))
    : workouts;

  if (loading) {
    return <p className="text-sm text-secondary">Loading coach workouts…</p>;
  }
  if (error) {
    return <p className="text-error text-sm">{error}</p>;
  }
  if (workouts.length === 0) {
    return (
      <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
        No coach workouts published yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
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

      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {visibleWorkouts.map((workout) => (
          <CoachWodCard
            key={workout.id}
            workout={workout}
            selected={selectedWorkoutId === workout.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
