import { useId } from 'react';

interface MissionLockedModalProps {
  onDismiss: () => void;
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
export function MissionLockedModal({ onDismiss }: MissionLockedModalProps) {
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
        className="card w-full max-w-md space-y-4 p-6 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-display text-2xl uppercase tracking-widest text-accent">
          Mission locked
        </h2>
        <p className="text-sm leading-relaxed text-secondary">
          Systems are green to go. The squad has left the Rally Point. It&apos;s time to MOVE!
        </p>
        <button
          type="button"
          className="btn-primary w-full text-sm uppercase tracking-widest"
          onClick={onDismiss}
        >
          Cleared hot!
        </button>
      </div>
    </div>
  );
}
