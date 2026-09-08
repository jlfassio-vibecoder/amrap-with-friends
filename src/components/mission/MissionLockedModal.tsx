import { useId } from 'react';

export interface MissionLockedExercise {
  name: string;
  target?: number;
  unit?: string;
}

interface MissionLockedModalProps {
  workout: readonly MissionLockedExercise[];
  onDismiss: () => void;
}

function formatExerciseLabel(exercise: MissionLockedExercise): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }

  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

/**
 * Fires once, for every participant, on the transition into the setup
 * countdown — see `useMissionLockedModal`. It never gates or delays the
 * countdown running underneath it: dismissing early or leaving it alone both
 * just uncover a clock that has been ticking the whole time.
 *
 * "Cleared hot!" is a deliberate exception to the plain-English-on-anything-
 * you-click rule in CLAUDE.md. The tap does not choose or navigate anything —
 * it closes a stamp that has already said what to do in plain words ("It's
 * time to MOVE!") — so the button itself can stay in voice.
 */
export function MissionLockedModal({ workout, onDismiss }: MissionLockedModalProps) {
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="mission-locked-modal"
    >
      <div
        className="card w-full max-w-lg space-y-5 p-6 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-display text-2xl uppercase tracking-widest text-accent">
          Mission locked
        </h2>
        <p className="text-sm leading-relaxed text-secondary">
          Systems are green to go. The squad has left the Rally Point. It&apos;s time to MOVE!
        </p>
        {workout.length > 0 ? (
          <ol className="space-y-2 text-left text-base text-ink">
            {workout.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`} className="flex items-baseline gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{formatExerciseLabel(exercise)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <button
          type="button"
          className="btn-primary w-full text-sm uppercase tracking-widest"
          onClick={onDismiss}
        >
          Cleared hot!
        </button>
        <p className="hidden text-xs tracking-wide text-muted lg:block">
          Use spacebar to <span className="font-semibold text-secondary">LOG ROUNDS</span>
        </p>
      </div>
    </div>
  );
}
