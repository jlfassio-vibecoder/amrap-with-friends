import { useState } from 'react';

interface PartialRepsModalProps {
  repsPerRound: number;
  isSubmitting: boolean;
  onSubmit: (partialReps: number) => void;
}

export function PartialRepsModal({
  repsPerRound,
  isSubmitting,
  onSubmit,
}: PartialRepsModalProps) {
  const titleId = 'partial-reps-modal-title';
  const maxPartialReps = Math.max(0, repsPerRound - 1);
  const [partialReps, setPartialReps] = useState(0);

  const canDecrement = partialReps > 0;
  const canIncrement = partialReps < maxPartialReps;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="card w-full max-w-md space-y-4 p-6">
        <h2 id={titleId} className="text-display text-xl text-ink">
          Unfinished round
        </h2>
        <p className="text-sm text-secondary">
          How many reps did you complete in your unfinished round?
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
          <span className="text-display text-4xl tabular-nums text-accent">
            {partialReps}
          </span>
          <button
            type="button"
            className="btn-outline h-12 w-12 text-xl"
            disabled={!canIncrement || isSubmitting}
            onClick={() =>
              setPartialReps((value) => Math.min(maxPartialReps, value + 1))
            }
            aria-label="Increase partial reps"
          >
            +
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          0–{maxPartialReps} reps ({repsPerRound} reps per full round)
        </p>

        <button
          type="button"
          className="btn-primary w-full"
          disabled={isSubmitting}
          onClick={() => onSubmit(partialReps)}
        >
          {isSubmitting ? 'Submitting…' : 'Submit score'}
        </button>
      </div>
    </div>
  );
}
