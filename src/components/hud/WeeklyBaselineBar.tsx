import { useEffect, useState } from 'react';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import { formatWeekCountdown } from '@/lib/hud/formatWeekCountdown';
import { WEEKLY_BASELINE_MINUTES } from '@/lib/hud/types';

interface WeeklyBaselineBarProps {
  weekMinutes: number;
  weekPviAverage: number | null;
  weekEndsAt: string;
  baselineMinutes?: number;
}

export function WeeklyBaselineBar({
  weekMinutes,
  weekPviAverage,
  weekEndsAt,
  baselineMinutes = WEEKLY_BASELINE_MINUTES,
}: WeeklyBaselineBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fillPercent = Math.min(100, (weekMinutes / baselineMinutes) * 100);
  const pviTier = getPviMultiplier(weekPviAverage);
  const countdown = formatWeekCountdown(weekEndsAt, nowMs);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card space-y-4 p-4" aria-label="Weekly baseline">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Weekly baseline</p>
        <p className="text-display text-2xl tabular-nums text-ink">
          {weekMinutes} / {baselineMinutes} Min
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-sm border border-border bg-page"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={baselineMinutes}
        aria-valuenow={Math.min(weekMinutes, baselineMinutes)}
        aria-label="Weekly minutes toward baseline"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${fillPercent}%` }}
          data-testid="weekly-baseline-fill"
        />
      </div>

      {weekMinutes === 0 ? (
        <p className="text-sm text-secondary">
          No locked missions this week. Finish a workout and save it to your account — only locked
          scores count.
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-divider pt-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Week P.V.I. average
          </p>
          <p className="text-display text-lg tabular-nums text-ink">
            {weekPviAverage === null ? 'N/A' : `${weekPviAverage}%`}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {pviTier.classification}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Reset in</p>
          <p className="text-display text-lg tabular-nums text-ink">{countdown}</p>
        </div>
      </div>
    </section>
  );
}
