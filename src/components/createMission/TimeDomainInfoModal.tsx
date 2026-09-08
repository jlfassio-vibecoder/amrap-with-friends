import { useEffect, useId } from 'react';
import type { TimeDomain } from '@/data/workoutTemplates';
import { guidanceForDomain, type TimeDomainRatings } from '@/data/timeDomainGuidance';
import { formatCapRange } from '@/lib/timeDomains';

interface TimeDomainInfoModalProps {
  domain: TimeDomain;
  onClose: () => void;
  onBrowse: (domain: TimeDomain) => void;
}

const RATING_ROWS: Array<{ key: keyof TimeDomainRatings; label: string }> = [
  { key: 'fatBurnRate', label: 'Calorie burn rate' },
  { key: 'muscleStress', label: 'Muscle stress' },
  { key: 'cardio', label: 'Cardio engine' },
  { key: 'totalWork', label: 'Total session work' },
];

const AXIS_SECTIONS: Array<{
  key: 'fatBurn' | 'muscle' | 'cardio' | 'feel';
  label: string;
}> = [
  { key: 'fatBurn', label: 'Fat burning & calorie burn' },
  { key: 'muscle', label: 'Muscle building & toning' },
  { key: 'cardio', label: 'Cardio conditioning' },
  { key: 'feel', label: 'How it feels' },
];

export function TimeDomainInfoModal({ domain, onClose, onBrowse }: TimeDomainInfoModalProps) {
  const titleId = useId();
  const guidance = guidanceForDomain(domain);
  const range = formatCapRange(domain);

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
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {guidance.brandName} · {range}
            </p>
            <h2 id={titleId} className="text-display text-2xl text-ink">
              {domain} min domain
            </h2>
            <p className="text-sm text-secondary">{guidance.tagline}</p>
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

        <section className="space-y-3" aria-label="Fitness benefit profile">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Benefit profile
          </p>
          <ul className="space-y-2">
            {RATING_ROWS.map(({ key, label }) => {
              const value = guidance.ratings[key];
              return (
                <li key={key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-secondary">{label}</span>
                    <span className="tabular-nums text-muted">{value}/10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-page">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${value * 10}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4">
          {AXIS_SECTIONS.map(({ key, label }) => (
            <section key={key} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
              <p className="text-sm leading-relaxed text-secondary">{guidance[key]}</p>
            </section>
          ))}
        </div>

        <section className="space-y-2 rounded-card border border-border bg-page p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Best fit</p>
          <p className="text-sm leading-relaxed text-ink">{guidance.bestFit}</p>
        </section>

        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            onBrowse(domain);
            onClose();
          }}
        >
          Browse {domain} min missions
        </button>
      </div>
    </div>
  );
}
