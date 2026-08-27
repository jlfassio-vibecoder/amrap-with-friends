import { evaluateOvertrainingRisk } from '@/lib/hud/evaluateOvertrainingRisk';
import type { HudOvertraining } from '@/lib/hud/types';

interface OvertrainingWarningCardProps {
  overtraining: HudOvertraining;
}

const RISK_LABEL = {
  elevated: 'Elevated Risk',
  high: 'High Risk',
} as const;

export function OvertrainingWarningCard({ overtraining }: OvertrainingWarningCardProps) {
  const result = evaluateOvertrainingRisk(overtraining);

  if (result.riskLevel === 'normal') {
    return null;
  }

  const toneClass =
    result.riskLevel === 'high'
      ? 'border-accent bg-accent-tint'
      : 'border-border bg-accent-tint/60';

  return (
    <section
      className={`card space-y-3 border p-4 ${toneClass}`}
      aria-label="Overtraining warning"
      data-testid="overtraining-warning-card"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
          Overtraining Signal
        </p>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          {RISK_LABEL[result.riskLevel]}
        </span>
      </div>

      <ul className="space-y-1">
        {result.warnings.map((warning) => (
          <li key={warning} className="text-sm text-ink">
            {warning}
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">ACWR</dt>
          <dd className="tabular-nums text-ink">
            {result.acwr === null ? '—' : result.acwr.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Acute (7d)</dt>
          <dd className="tabular-nums text-ink">{overtraining.acuteLoad7d}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Chronic (28d)</dt>
          <dd className="tabular-nums text-ink">{overtraining.chronicWeeklyLoad28d}</dd>
        </div>
      </dl>

      <p className="text-xs text-secondary">
        {overtraining.consecutiveHighIntensityDays} consecutive high-intensity day
        {overtraining.consecutiveHighIntensityDays === 1 ? '' : 's'} across AMRAP sessions and
        logged activity.
      </p>
    </section>
  );
}
