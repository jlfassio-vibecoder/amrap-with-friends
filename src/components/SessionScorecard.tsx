import type { LeaderboardEntry } from '@/lib/sessionSync/types';
import { ScoreBreakdownDisplay } from '@/components/ScoreBreakdownDisplay';

interface SessionScorecardProps {
  entry: LeaderboardEntry;
  onClose: () => void;
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

        <ScoreBreakdownDisplay
          breakdown={{
            baseScore: entry.baseScore,
            pvi: entry.pvi,
            pviMultiplier: entry.pviMultiplier,
            domainWeight: entry.domainWeight,
            finalScore: entry.finalScore,
          }}
          showPviInsights
        />
      </div>
    </div>
  );
}
