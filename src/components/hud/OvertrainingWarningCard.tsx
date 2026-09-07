import { useId, useState } from 'react';
import { evaluateOvertrainingRisk } from '@/lib/hud/evaluateOvertrainingRisk';
import type { HudOvertraining } from '@/lib/hud/types';

interface OvertrainingWarningCardProps {
  overtraining: HudOvertraining;
}

const RISK_LABEL = {
  normal: 'Learning Your Normal',
  building: 'Building Base',
  elevated: 'Elevated Risk',
  high: 'High Risk',
} as const;

export function OvertrainingWarningCard({ overtraining }: OvertrainingWarningCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const infoId = useId();
  const result = evaluateOvertrainingRisk(overtraining);

  // While the baseline is still forming the card stays on screen even at normal
  // risk. These are the athlete's first four weeks: the minutes and the
  // comparison are the useful part, and hiding them until something goes wrong
  // is what left the numbers unexplained in the first place.
  if (result.riskLevel === 'normal' && !result.isLearningBaseline) {
    return null;
  }

  // Building a base is not a warning and must not be dressed as one — an
  // athlete below their own weekly target reading a red card is exactly the
  // contradiction this state exists to remove.
  const isWarning = result.riskLevel === 'high' || result.riskLevel === 'elevated';
  // Load — minutes x intensity — is bookkeeping, not something an athlete
  // chooses or can feel. The card leads with minutes and with the ratio said
  // in words, and keeps the raw load behind the ⓘ for anyone who wants it.
  const hasMinutes = overtraining.chronicWeeklyMinutes28d > 0 || overtraining.acuteMinutes7d > 0;
  const multiple = result.acwr === null ? null : `${result.acwr.toFixed(1)}×`;
  const toneClass =
    result.riskLevel === 'high'
      ? 'border-accent bg-accent-tint'
      : result.riskLevel === 'elevated'
        ? 'border-border bg-accent-tint/60'
        : 'border-border bg-surface';

  return (
    <section
      className={`card space-y-3 border p-4 ${toneClass}`}
      aria-label="Overtraining warning"
      data-testid="overtraining-warning-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            {isWarning ? 'Overtraining Signal' : 'Training Load'}
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
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            isWarning ? 'text-accent' : 'text-secondary'
          }`}
        >
          {RISK_LABEL[result.riskLevel]}
        </span>
      </div>

      {showInfo ? (
        <div
          id={infoId}
          className="space-y-2 rounded-card border border-border bg-surface p-3 text-xs text-secondary"
        >
          <p>
            <span className="font-semibold text-ink">This week</span> is the minutes you trained in
            the last 7 days, missions and logged outside activity together.{' '}
            <span className="font-semibold text-ink">Your typical week</span> is the same thing
            averaged over the history you have, up to 28 days.
          </p>
          <p>
            <span className="font-semibold text-ink">Compared</span> is one divided by the other,
            weighted by how hard each session was rather than just how long. 1× is a normal week. 2×
            means you did twice your usual.
          </p>
          <p>
            The weighting uses <span className="font-semibold text-ink">load</span> — minutes ×
            intensity (1–5). Right now that is {overtraining.acuteLoad7d} for the last 7 days
            against {overtraining.chronicWeeklyLoad28d} for a typical week. It is a bookkeeping
            unit; the minutes above are the part you actually choose.
          </p>
          <p>
            Above 1.5× means training is ramping up faster than the body is used to; above 2× is a
            bigger jump. It&apos;s a rate-of-change signal, not proof of an injury — and the answer
            is always a lighter mission rather than a day off, because stopping lowers the baseline
            that triggered it.
          </p>
          <p>
            For your first four weeks the comparison is marked as still settling and is never
            escalated to High Risk. Over nine days of history, one hard session moves the average
            enough to swing it on its own.
          </p>
          <p>
            While your typical week is still light the ratio is reported but not treated as a risk.
            A ratio measured against a near-empty baseline says nothing about how hard you are
            actually training, so below that point this card reads as{' '}
            <span className="font-semibold text-ink">Building Base</span> instead.
          </p>
          <p>
            Consecutive high-intensity days count hard efforts in a row (5+ is flagged) as a
            separate early sign of not recovering between missions.
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {result.guidance.map((item) => (
          <li key={item.headline} className="space-y-1">
            <p className="text-sm font-semibold text-ink">{item.headline}</p>
            <p className="text-sm text-secondary">{item.because}</p>
            <p className="text-sm text-ink">
              <span className="font-semibold">Do this: </span>
              {item.doThis}
            </p>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">This week</dt>
          <dd className="tabular-nums text-ink">
            {hasMinutes
              ? `${Math.round(overtraining.acuteMinutes7d)} min`
              : overtraining.acuteLoad7d}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Your typical week</dt>
          <dd className="tabular-nums text-ink">
            {hasMinutes
              ? `${Math.round(overtraining.chronicWeeklyMinutes28d)} min`
              : overtraining.chronicWeeklyLoad28d}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Compared</dt>
          <dd className="tabular-nums text-ink">{multiple ?? '—'}</dd>
        </div>
      </dl>

      {result.isLearningBaseline ? (
        <p className="text-xs text-secondary">
          Based on {result.observedDays} of 28 days. Your typical week is still settling.
        </p>
      ) : null}

      <p className="text-xs text-secondary">
        {overtraining.consecutiveHighIntensityDays} consecutive high-intensity day
        {overtraining.consecutiveHighIntensityDays === 1 ? '' : 's'} across AMRAP missions and
        logged activity.
      </p>
    </section>
  );
}
