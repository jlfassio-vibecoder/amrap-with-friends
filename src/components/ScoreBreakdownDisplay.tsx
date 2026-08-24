import type { ScoreBreakdown } from '@/lib/scoring/types';
import { PacingBarChart } from '@/components/PacingBarChart';

interface ScoreBreakdownDisplayProps {
  breakdown: ScoreBreakdown;
  roundCount?: number;
  partialReps?: number;
  roundSplits?: number[];
  durationMinutes?: number;
  showPacingChart?: boolean;
}

function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}

export function ScoreBreakdownDisplay({
  breakdown,
  roundCount,
  partialReps,
  roundSplits,
  durationMinutes,
  showPacingChart = false,
}: ScoreBreakdownDisplayProps) {
  const resolvedRoundCount = roundCount ?? breakdown.roundCount;
  const resolvedPartialReps = partialReps ?? 0;
  const resolvedRoundSplits = roundSplits ?? breakdown.roundSplits ?? [];
  const canShowChart =
    showPacingChart &&
    resolvedRoundSplits.length > 0 &&
    typeof durationMinutes === 'number';

  return (
    <>
      <div className="rounded-card border border-border bg-accent-tint px-4 py-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Final score</p>
        <p className="text-display text-5xl tabular-nums text-accent">{breakdown.finalScore}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-card border border-border bg-page p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Base score</p>
          <p className="text-display text-xl tabular-nums text-ink">{breakdown.baseScore}</p>
        </div>
        <div className="rounded-card border border-border bg-page p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">P.V.I.</p>
          <p className="text-display text-xl tabular-nums text-ink">
            {formatMultiplier(breakdown.pviMultiplier)}
          </p>
        </div>
        <div className="rounded-card border border-border bg-page p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Domain</p>
          <p className="text-display text-xl tabular-nums text-ink">
            {formatMultiplier(breakdown.domainWeight)}
          </p>
        </div>
      </div>

      {typeof resolvedRoundCount === 'number' ? (
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-ink">
          Rounds completed: {resolvedRoundCount} | Partial reps: {resolvedPartialReps}
        </p>
      ) : null}

      {canShowChart ? (
        <PacingBarChart
          roundSplits={resolvedRoundSplits}
          durationMinutes={durationMinutes}
          pvi={breakdown.pvi}
        />
      ) : null}
    </>
  );
}
