import { useId, useState } from 'react';
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
  const [showInfo, setShowInfo] = useState(false);
  const infoId = useId();
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
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            Overtraining Signal
          </p>
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-secondary text-[10px] font-semibold leading-none text-secondary hover:border-ink hover:text-ink"
            aria-expanded={showInfo}
            aria-controls={infoId}
            aria-label="What does this mean?"
            onClick={() => setShowInfo((v) => !v)}
          >
            i
          </button>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          {RISK_LABEL[result.riskLevel]}
        </span>
      </div>

      {showInfo ? (
        <div
          id={infoId}
          className="space-y-2 rounded-card border border-border bg-surface p-3 text-xs text-secondary"
        >
          <p>
            <span className="font-semibold text-ink">Load</span> = minutes trained × how hard it
            felt (1–5), added up across AMRAP missions and anything logged as outside activity.
          </p>
          <p>
            <span className="font-semibold text-ink">Acute (7d)</span> is that load over the last
            week. <span className="font-semibold text-ink">Chronic (28d)</span> is their typical
            week over the last month — a baseline to compare against.
          </p>
          <p>
            <span className="font-semibold text-ink">ACWR</span> is Acute ÷ Chronic. Above 1.5 means
            training is ramping up faster than the body is used to; above 2.0 is a bigger jump.
            It&apos;s a rate-of-change warning, not proof of an injury — it flags a good moment to
            hold volume steady or add a rest day before pushing further.
          </p>
          <p>
            Consecutive high-intensity days count hard efforts in a row (5+ is flagged) as a
            separate early sign of not recovering between missions.
          </p>
        </div>
      ) : null}

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
        {overtraining.consecutiveHighIntensityDays === 1 ? '' : 's'} across AMRAP missions and
        logged activity.
      </p>
    </section>
  );
}
