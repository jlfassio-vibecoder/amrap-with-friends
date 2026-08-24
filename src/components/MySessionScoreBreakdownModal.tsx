import type { MySessionEntry } from '@/lib/api/mySessions';
import { ScoreBreakdownDisplay } from '@/components/ScoreBreakdownDisplay';

interface MySessionScoreBreakdownModalProps {
  entry: MySessionEntry;
  onClose: () => void;
}

export function MySessionScoreBreakdownModal({
  entry,
  onClose,
}: MySessionScoreBreakdownModalProps) {
  if (!entry.scoreBreakdown) {
    return null;
  }

  const titleId = 'my-session-score-breakdown-title';

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
            Score breakdown
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

        <ScoreBreakdownDisplay breakdown={entry.scoreBreakdown} />
      </div>
    </div>
  );
}
