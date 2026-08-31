import { useState } from 'react';
import type { MissedRoundEstimate } from '@/lib/amrapTimer/computeMissedRoundElapsedSec';
import { formatSplitDuration } from '@/lib/missionSync/computeParticipantSplits';

interface LogMissedRoundProps {
  /** 1-based number of the round the athlete is about to log. */
  roundNumber: number;
  /** Total reps in one round of this workout. */
  repsPerRound: number;
  /** What a given rep count would do, recomputed as the athlete adjusts it. */
  preview: (repsIntoNextRound: number) => MissedRoundEstimate;
  onConfirm: (repsIntoNextRound: number) => void;
}

/**
 * Recovers a forgotten Log round without costing the athlete their pacing score.
 *
 * The one question it asks — how far into the next round you already were — is
 * the only thing the athlete actually knows mid-workout, and it is enough to
 * put the round boundary back where it belongs. The estimate is shown before it
 * is committed, because a correction the athlete cannot see is one they cannot
 * trust.
 */
export function LogMissedRound({
  roundNumber,
  repsPerRound,
  preview,
  onConfirm,
}: LogMissedRoundProps) {
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState(0);

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm text-secondary underline underline-offset-4 hover:text-ink"
        onClick={() => {
          setReps(0);
          setOpen(true);
        }}
      >
        Forgot to log a round?
      </button>
    );
  }

  const estimate = preview(reps);
  const step = repsPerRound >= 40 ? 5 : 1;

  function nudge(delta: number) {
    setReps((current) => Math.min(repsPerRound, Math.max(0, current + delta)));
  }

  return (
    <div className="w-full space-y-3 rounded-card border border-border bg-surface-muted p-4 text-left">
      <div>
        <p className="text-sm font-semibold text-ink">Log round {roundNumber} late</p>
        <p className="mt-1 text-xs text-secondary">
          Total reps of round {roundNumber + 1} you had finished when you noticed — count every
          movement.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          className="btn-outline h-16 w-16 p-0 text-2xl font-semibold"
          aria-label={`Fewer reps (minus ${step})`}
          disabled={reps === 0}
          onClick={() => nudge(-step)}
        >
          −
        </button>
        <div className="min-w-24 text-center">
          <span className="text-display text-4xl tabular-nums text-ink">{reps}</span>
          <span className="block text-xs text-muted">of {repsPerRound} a round</span>
        </div>
        <button
          type="button"
          className="btn-outline h-16 w-16 p-0 text-2xl font-semibold"
          aria-label={`More reps (plus ${step})`}
          disabled={reps >= repsPerRound}
          onClick={() => nudge(step)}
        >
          +
        </button>
      </div>

      <p className="text-xs text-secondary" aria-live="polite">
        {estimate.isUncorrected ? (
          <>Logs round {roundNumber} at the clock as it stands now.</>
        ) : (
          <>
            Round {roundNumber} lands at{' '}
            <span className="font-semibold tabular-nums text-ink">
              {formatSplitDuration(estimate.elapsedSecAtRound)}
            </span>{' '}
            — a{' '}
            <span className="font-semibold tabular-nums text-ink">
              {formatSplitDuration(estimate.missedRoundSplitSec)}
            </span>{' '}
            split, with {formatSplitDuration(estimate.carriedSplitSec)} already banked toward round{' '}
            {roundNumber + 1}.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-success text-sm"
          onClick={() => {
            onConfirm(reps);
            setOpen(false);
          }}
        >
          Log round {roundNumber}
        </button>
        <button type="button" className="btn-outline text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
