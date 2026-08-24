import type { MySessionEntry } from '@/lib/api/mySessions';
import { resolvePacingData } from '@/lib/scoring/resolvePacingData';
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
  const pacingData = resolvePacingData({
    breakdown: entry.scoreBreakdown,
    roundCount: entry.roundCount,
    partialReps: entry.partialReps,
  });

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

        <ScoreBreakdownDisplay
          breakdown={entry.scoreBreakdown}
          roundCount={pacingData?.roundCount}
          partialReps={pacingData?.partialReps}
          roundSplits={pacingData?.roundSplits}
          durationMinutes={entry.durationMinutes}
          showPacingChart
        />
      </div>
    </div>
  );
}
