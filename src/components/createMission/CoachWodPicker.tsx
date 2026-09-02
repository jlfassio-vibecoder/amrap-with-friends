import { useEffect, useMemo, useState } from 'react';
import { CoachExerciseInfoModal } from '@/components/coachWod/CoachExerciseInfoModal';
import { RecoveryLockMessage } from '@/components/createMission/RecoveryLockMessage';
import { SmartRecoveryToggle } from '@/components/createMission/SmartRecoveryToggle';
import { fetchPublishedCoachWorkouts, type PublishedCoachWorkout } from '@/lib/api/coachWod';
import { coachWorkoutLockId } from '@/lib/smartRecovery/deriveCoachWorkoutPatterns';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';

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
  locked: boolean;
  recoveryLock: TemplateRecoveryLock | null;
  onSelect: (workout: PublishedCoachWorkout) => void;
}

function CoachWodCard({ workout, selected, locked, recoveryLock, onSelect }: CoachWodCardProps) {
  const [howtoExercise, setHowtoExercise] = useState<NonNullable<
    (typeof workout.movements)[number]['exercise']
  > | null>(null);

  function handleSelect() {
    if (locked) {
      return;
    }
    onSelect(workout);
  }

  return (
    <div
      className={
        locked
          ? 'space-y-3 rounded-card border border-border bg-surface p-4 opacity-50'
          : selected
            ? 'bg-accent-tint/40 space-y-3 rounded-card border-2 border-accent p-4'
            : 'space-y-3 rounded-card border border-border bg-surface p-4'
      }
    >
      <button
        type="button"
        className={locked ? 'block w-full cursor-not-allowed text-left' : 'block w-full text-left'}
        aria-disabled={locked}
        onClick={handleSelect}
      >
        <p className="text-sm font-semibold text-ink">{workout.name}</p>
        {workout.focus ? <p className="text-xs text-secondary">{workout.focus}</p> : null}
        <p className="mt-1 text-xs text-secondary">
          {workout.durationMinutes}m ·{' '}
          {INTENSITY_LABEL[workout.intensityTier] ?? workout.intensityTier}
          {workout.tags.length > 0 ? ` · ${workout.tags.join(', ')}` : ''}
        </p>
        {locked && recoveryLock ? <RecoveryLockMessage lock={recoveryLock} /> : null}
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
                  onClick={() => setHowtoExercise(movement.exercise)}
                >
                  How to
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {howtoExercise ? (
        <CoachExerciseInfoModal exercise={howtoExercise} onClose={() => setHowtoExercise(null)} />
      ) : null}
    </div>
  );
}

interface CoachWodPickerProps {
  selectedWorkoutId: string | null;
  smartRecoveryEnabled: boolean;
  onSmartRecoveryEnabledChange: (enabled: boolean) => void;
  recoveryLocks: Map<string, TemplateRecoveryLock>;
  smartRecoveryActive: boolean;
  smartRecoveryLoading?: boolean;
  smartRecoveryError?: string | null;
  isAuthenticated: boolean;
  onSelect: (workout: PublishedCoachWorkout) => void;
}

export function CoachWodPicker({
  selectedWorkoutId,
  smartRecoveryEnabled,
  onSmartRecoveryEnabledChange,
  recoveryLocks,
  smartRecoveryActive,
  smartRecoveryLoading = false,
  smartRecoveryError = null,
  isAuthenticated,
  onSelect,
}: CoachWodPickerProps) {
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

  const visibleWorkouts = activeTag ? workouts.filter((w) => w.tags.includes(activeTag)) : workouts;

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
      <SmartRecoveryToggle
        enabled={smartRecoveryEnabled}
        onChange={onSmartRecoveryEnabledChange}
        isAuthenticated={isAuthenticated}
        loading={smartRecoveryLoading}
        error={smartRecoveryError}
      />

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
        {visibleWorkouts.map((workout) => {
          const recoveryLock = recoveryLocks.get(coachWorkoutLockId(workout.id)) ?? null;
          const locked = smartRecoveryActive && recoveryLock !== null;

          return (
            <CoachWodCard
              key={workout.id}
              workout={workout}
              selected={selectedWorkoutId === workout.id}
              locked={locked}
              recoveryLock={recoveryLock}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
