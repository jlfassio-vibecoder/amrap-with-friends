import { useState } from 'react';
import { HonestyLockCheckbox } from '@/components/HonestyLockCheckbox';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { normalizeModifiedMovements } from '@/lib/mission/modifiedMovements';

interface PartialRepsModalProps {
  repsPerRound: number;
  isSubmitting: boolean;
  error?: string | null;
  /** The movements as programmed, so the athlete can mark any they changed. */
  workout?: WorkoutExercise[];
  onSubmit: (partialReps: number, modifiedMovements: string[]) => void;
}

export function PartialRepsModal({
  repsPerRound,
  isSubmitting,
  error,
  workout = [],
  onSubmit,
}: PartialRepsModalProps) {
  const titleId = 'partial-reps-modal-title';
  const maxPartialReps = Math.max(0, repsPerRound - 1);
  const [partialReps, setPartialReps] = useState(0);
  const [integrityAcknowledged, setIntegrityAcknowledged] = useState(false);
  const [modified, setModified] = useState<string[]>([]);

  function toggleModified(name: string) {
    setModified((current) =>
      current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]
    );
  }

  const canDecrement = partialReps > 0;
  const canIncrement = partialReps < maxPartialReps;
  const canSubmit = integrityAcknowledged && !isSubmitting;

  let submitLabel = 'Submit';
  if (isSubmitting) {
    submitLabel = 'Submitting…';
  } else if (canSubmit) {
    submitLabel = 'I EARNED THIS';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="card w-full max-w-md space-y-4 p-6">
        <h2 id={titleId} className="text-display text-xl text-ink">
          TIME CALLED. BREATHE.
        </h2>
        <p className="text-sm text-secondary">
          Where did you break? Log the exact reps completed in your final, unfinished round.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="btn-outline h-12 w-12 text-xl"
            disabled={!canDecrement || isSubmitting}
            onClick={() => setPartialReps((value) => Math.max(0, value - 1))}
            aria-label="Decrease partial reps"
          >
            −
          </button>
          <span className="text-display text-4xl tabular-nums text-accent">{partialReps}</span>
          <button
            type="button"
            className="btn-outline h-12 w-12 text-xl"
            disabled={!canIncrement || isSubmitting}
            onClick={() => setPartialReps((value) => Math.min(maxPartialReps, value + 1))}
            aria-label="Increase partial reps"
          >
            +
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          0–{maxPartialReps} reps ({repsPerRound} reps per full round)
        </p>

        <HonestyLockCheckbox
          checked={integrityAcknowledged}
          disabled={isSubmitting}
          onChange={setIntegrityAcknowledged}
        />

        {workout.length > 0 ? (
          <fieldset className="space-y-2 border-t border-divider pt-4">
            <legend className="text-sm font-semibold text-ink">Did you modify any movement?</legend>
            <div className="space-y-1.5">
              {workout.map((exercise) => (
                <label
                  key={exercise.name}
                  className="flex cursor-pointer items-center gap-3 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    checked={modified.includes(exercise.name)}
                    disabled={isSubmitting}
                    onChange={() => toggleModified(exercise.name)}
                  />
                  {exercise.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">
              Marked movements are shown on your score. They do not lower it.
            </p>
          </fieldset>
        ) : null}

        {error ? <p className="text-error text-sm">{error}</p> : null}

        <button
          type="button"
          className={
            canSubmit ? 'btn-primary w-full' : 'btn-outline w-full cursor-not-allowed opacity-50'
          }
          disabled={!canSubmit}
          onClick={() => onSubmit(partialReps, normalizeModifiedMovements(modified, workout))}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
