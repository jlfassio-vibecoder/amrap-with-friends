import type { ScoreBreakdown } from '@/lib/scoring/types';
import { formatMultiplier } from '@/lib/scoring/formatMultiplier';
import { PacingBarChart } from '@/components/PacingBarChart';
import { ScoreStatInfoTrigger } from '@/components/scoring/ScoreStatInfoTrigger';

interface ScoreBreakdownDisplayProps {
  breakdown: ScoreBreakdown;
  roundCount?: number;
  partialReps?: number;
  roundSplits?: number[];
  durationMinutes?: number;
  showPacingChart?: boolean;
  /** Whether baseScore is reps (>0) or rounds (0) — labels the Base score card accordingly. Omit the suffix entirely when unknown. */
  repsPerRound?: number;
}

export function ScoreBreakdownDisplay({
  breakdown,
  roundCount,
  partialReps,
  roundSplits,
  durationMinutes,
  showPacingChart = false,
  repsPerRound,
}: ScoreBreakdownDisplayProps) {
  const resolvedRoundCount = roundCount ?? breakdown.roundCount;
  const resolvedPartialReps = partialReps ?? 0;
  const resolvedRoundSplits = roundSplits ?? breakdown.roundSplits ?? [];
  const canShowChart =
    showPacingChart && resolvedRoundSplits.length > 0 && typeof durationMinutes === 'number';
  const baseScoreUnit =
    repsPerRound === undefined ? '' : repsPerRound > 0 ? ' (reps)' : ' (rounds)';

  return (
    <>
      <div className="rounded-card border border-border bg-accent-tint px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          Final score
          <ScoreStatInfoTrigger statId="finalScore" />
        </div>
        <p className="text-display text-5xl tabular-nums text-accent">{breakdown.finalScore}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-card border border-border bg-page p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            Base score{baseScoreUnit}
            <ScoreStatInfoTrigger statId="baseScore" repsPerRound={repsPerRound} />
          </div>
          <p className="text-display text-xl tabular-nums text-ink">{breakdown.baseScore}</p>
        </div>
        <div className="rounded-card border border-border bg-page p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            P.V.I.
            <ScoreStatInfoTrigger statId="pviMultiplier" />
          </div>
          <p className="text-display text-xl tabular-nums text-ink">
            {formatMultiplier(breakdown.pviMultiplier)}
          </p>
        </div>
        <div className="rounded-card border border-border bg-page p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            Domain
            <ScoreStatInfoTrigger statId="domainWeight" />
          </div>
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
