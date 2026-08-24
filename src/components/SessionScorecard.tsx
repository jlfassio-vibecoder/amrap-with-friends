import type { LeaderboardEntry } from '@/lib/sessionSync/types';

interface SessionScorecardProps {
  entry: LeaderboardEntry;
  onClose: () => void;
}

function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}

export function SessionScorecard({ entry, onClose }: SessionScorecardProps) {
  const titleId = 'session-scorecard-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-5 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-xl text-ink">
            Session results
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-card border border-border bg-page p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Base score</p>
            <p className="text-display text-2xl tabular-nums text-ink">{entry.baseScore} reps</p>
          </div>
          <div className="rounded-card border border-border bg-page p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Final score</p>
            <p className="text-display text-2xl tabular-nums text-accent">
              {entry.adjustedScore} reps
            </p>
          </div>
          <div className="rounded-card border border-border bg-page p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">P.V.I.</p>
            <p className="text-display text-2xl tabular-nums text-ink">
              {entry.pvi === null ? 'N/A' : `${entry.pvi}%`}
            </p>
          </div>
          <div className="rounded-card border border-border bg-page p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Multiplier</p>
            <p className="text-display text-2xl tabular-nums text-ink">
              {formatMultiplier(entry.pviMultiplier)}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-card border border-border bg-accent-tint p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {entry.pviClassification}
          </p>
          <p className="text-display text-lg leading-snug text-ink">{entry.pviVerdict}</p>
        </div>
      </div>
    </div>
  );
}
