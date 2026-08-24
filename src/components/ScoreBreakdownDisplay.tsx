import type { ScoreBreakdown } from '@/lib/scoring/types';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';

interface ScoreBreakdownDisplayProps {
  breakdown: ScoreBreakdown;
  showPviInsights?: boolean;
}

function formatMultiplier(multiplier: number): string {
  return `× ${Number(multiplier.toFixed(2))}`;
}

export function ScoreBreakdownDisplay({
  breakdown,
  showPviInsights = false,
}: ScoreBreakdownDisplayProps) {
  const pviTier = getPviMultiplier(breakdown.pvi);

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

      <div className="rounded-card border border-border bg-page p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">P.V.I. variance</p>
        <p className="text-display text-lg tabular-nums text-ink">
          {breakdown.pvi === null ? 'N/A' : `${breakdown.pvi}%`}
        </p>
      </div>

      {showPviInsights ? (
        <div className="space-y-2 rounded-card border border-border bg-accent-tint p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {pviTier.classification}
          </p>
          <p className="text-display text-lg leading-snug text-ink">{pviTier.verdict}</p>
        </div>
      ) : null}
    </>
  );
}
