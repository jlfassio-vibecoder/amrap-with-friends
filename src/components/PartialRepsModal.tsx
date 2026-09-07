import { useState } from 'react';
import { HonestyLockCheckbox } from '@/components/HonestyLockCheckbox';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { normalizeModifiedMovements } from '@/lib/mission/modifiedMovements';
import {
  normalizeMovementVariants,
  scalingOptionsForMovement,
  type MovementVariantSelection,
} from '@/lib/mission/exerciseScaling';

interface PartialRepsModalProps {
  repsPerRound: number;
  isSubmitting: boolean;
  error?: string | null;
  /** The movements as programmed, so the athlete can mark any they changed. */
  workout?: WorkoutExercise[];
  onSubmit: (
    partialReps: number,
    modifiedMovements: string[],
    movementVariants: MovementVariantSelection
  ) => void;
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
  const [variants, setVariants] = useState<MovementVariantSelection>({});

  function toggleModified(name: string) {
    setModified((current) => {
      if (current.includes(name)) {
        // Un-marking a movement drops the scaling with it — a named variant on a
        // movement the athlete says they did as programmed is a contradiction.
        setVariants((current) =>
          Object.fromEntries(Object.entries(current).filter(([key]) => key !== name))
        );
        return current.filter((entry) => entry !== name);
      }
      return [...current, name];
    });
  }

  function chooseVariant(name: string, optionId: string) {
    setVariants((current) =>
      current[name] === optionId
        ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== name))
        : { ...current, [name]: optionId }
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
            <div className="space-y-2">
              {workout.map((exercise) => {
                const isModified = modified.includes(exercise.name);
                const options = scalingOptionsForMovement(exercise.name);
                return (
                  <div key={exercise.name} className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                        checked={isModified}
                        disabled={isSubmitting}
                        onChange={() => toggleModified(exercise.name)}
                      />
                      {exercise.name}
                    </label>
                    {isModified && options.length > 0 ? (
                      <div className="ml-7 flex flex-wrap gap-1.5">
                        {options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            title={option.how}
                            aria-pressed={variants[exercise.name] === option.id}
                            disabled={isSubmitting}
                            className={
                              variants[exercise.name] === option.id
                                ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
                                : 'rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink'
                            }
                            onClick={() => chooseVariant(exercise.name, option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              Naming how you scaled it lets you compare against the same version next time. Marked
              movements are shown on your score. They do not lower it.
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
          onClick={() =>
            onSubmit(
              partialReps,
              normalizeModifiedMovements(modified, workout),
              normalizeMovementVariants(variants, workout)
            )
          }
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
