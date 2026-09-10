import { useEffect, useId } from 'react';

interface SmartRecoveryInfoModalProps {
  onClose: () => void;
}

/**
 * Explains the optional recovery advisory on Plan mission / Next Mission.
 * Windows match src/lib/smartRecovery/recoveryRules.ts.
 */
export function SmartRecoveryInfoModal({ onClose }: SmartRecoveryInfoModalProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-2xl text-ink">
            Smart Recovery
          </h2>
          <button
            type="button"
            className="shrink-0 text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm leading-relaxed text-secondary">
          When it is on, the workout library soft-locks missions that need more recovery based on
          your recent scored work. Locked cards stay visible with time remaining. Turn it off any
          time to pick anything.
        </p>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            What it locks
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-secondary">
            <li className="rounded-card border border-border bg-page px-3 py-2.5">
              <span className="font-semibold text-ink">Same workout · 6 days</span>
              <span className="mt-0.5 block">
                After you finish a mission, that exact workout stays locked.
              </span>
            </li>
            <li className="rounded-card border border-border bg-page px-3 py-2.5">
              <span className="font-semibold text-ink">Hard missions · 72 hours</span>
              <span className="mt-0.5 block">
                After a high-intensity mission (tier 4 or 5), other hard library workouts stay
                locked.
              </span>
            </li>
            <li className="rounded-card border border-border bg-page px-3 py-2.5">
              <span className="font-semibold text-ink">Same movement pattern · 48 hours</span>
              <span className="mt-0.5 block">
                Workouts that hit the same primary pattern as something you just scored stay locked.
              </span>
            </li>
          </ul>
        </section>

        <p className="text-sm leading-relaxed text-secondary">
          You need to be signed in so we can read your scored mission history. Guests see the
          control disabled until they sign in.
        </p>

        <button type="button" className="btn-primary w-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
