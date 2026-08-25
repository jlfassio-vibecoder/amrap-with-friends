import { useEffect, useId, type ReactElement } from 'react';
import { WORKOUT_STYLE_INFO } from '@/data/workoutStyles';
import {
  WORKOUT_CATEGORIES,
  type TimeDomain,
  type WorkoutCategory,
} from '@/data/workoutTemplates';

interface WorkoutStyleInfoModalProps {
  category: WorkoutCategory;
  onClose: () => void;
  onBrowse: (category: WorkoutCategory, durationMinutes?: TimeDomain) => void;
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </svg>
  );
}

function CoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 4v16" />
      <path d="M8 8h8" />
      <path d="M7 12h10" />
      <path d="M8 16h8" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function CascadeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6h4v4H6z" />
      <path d="M10 10h4v4h-4z" />
      <path d="M14 14h4v4h-4z" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<
  WorkoutCategory,
  (props: { className?: string }) => ReactElement
> = {
  'blood-shunt': SparkIcon,
  'localized-trap': TargetIcon,
  'engine-room': HeartIcon,
  'midline-tension': CoreIcon,
  'aerobic-matrix': GridIcon,
  'four-point-cascade': CascadeIcon,
  'armor-protocol': ShieldIcon,
};

export function WorkoutStyleInfoModal({
  category,
  onClose,
  onBrowse,
}: WorkoutStyleInfoModalProps) {
  const titleId = useId();
  const style = WORKOUT_STYLE_INFO[category];
  const meta = WORKOUT_CATEGORIES.find((entry) => entry.id === category);
  const durations = meta?.availableForDurations ?? [];
  const Icon = CATEGORY_ICONS[category];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleBrowse() {
    const soleDuration = durations.length === 1 ? durations[0] : undefined;
    onBrowse(category, soleDuration);
    onClose();
  }

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
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-accent text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-2">
              <h2 id={titleId} className="text-display text-2xl text-ink">
                {style.name}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {durations.map((duration) => (
                  <span
                    key={duration}
                    className="rounded-full border border-accent px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent"
                  >
                    {duration} MIN
                  </span>
                ))}
              </div>
            </div>
          </div>
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

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            The Protocol
          </p>
          <p className="text-sm leading-relaxed text-secondary">{style.protocol}</p>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Intended Results
          </p>
          <div className="space-y-2">
            {style.outcomes.map((outcome) => (
              <div
                key={outcome}
                className="flex items-center gap-3 rounded-card border border-border bg-page px-3 py-2.5"
              >
                <SparkIcon className="h-4 w-4 shrink-0 text-accent" />
                <p className="text-sm font-semibold text-ink">{outcome}</p>
              </div>
            ))}
          </div>
        </section>

        <button type="button" className="btn-primary w-full" onClick={handleBrowse}>
          Browse {style.name} workouts
        </button>
      </div>
    </div>
  );
}
