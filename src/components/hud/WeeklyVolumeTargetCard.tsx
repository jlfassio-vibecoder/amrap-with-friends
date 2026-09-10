import { useEffect, useState } from 'react';
import { evaluateBaselinePace } from '@/lib/hud/baselinePace';
import { formatWeekCountdown } from '@/lib/hud/formatWeekCountdown';
import { previousWeekToDateMinutes } from '@/lib/hud/weekHistory';
import type { HudHistoryWeek } from '@/lib/hud/types';

export type VolumeTargetShareNoun = 'baseline' | 'target';

export interface WeeklyVolumeTargetCardProps {
  title: string;
  ariaLabel: string;
  /** Optional line under the title (e.g. claimed rank + target). */
  subtitle?: string;
  weekMinutes: number;
  weekEndsAt: string;
  targetMinutes: number;
  /** Locked minutes from the previous local week, when history has one. */
  previousWeekMinutes?: number | null;
  /** Prior local week bucket — used to cut minutes by the same clock time last week. */
  previousWeek?: HudHistoryWeek | null;
  /** "% of baseline" vs "% of target" under Week to date. */
  shareNoun?: VolumeTargetShareNoun;
  /** Footer column heading for pace. */
  paceHeading?: string;
  /** Noun for evaluateBaselinePace met / short copy. */
  targetNoun?: VolumeTargetShareNoun;
  progressAriaLabel?: string;
  /** Prefix for data-testid values (fill, wtd, pace, …). */
  testIdPrefix?: string;
}

function formatSignedPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function formatSignedMinutesDelta(current: number, previous: number): string {
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} min`;
}

export function WeeklyVolumeTargetCard({
  title,
  ariaLabel,
  subtitle,
  weekMinutes,
  weekEndsAt,
  targetMinutes,
  previousWeekMinutes = null,
  previousWeek = null,
  shareNoun = 'baseline',
  paceHeading = 'Pace to baseline',
  targetNoun = 'baseline',
  progressAriaLabel = 'Weekly minutes toward target',
  testIdPrefix = 'weekly-volume',
}: WeeklyVolumeTargetCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fillPercent = Math.min(100, (weekMinutes / targetMinutes) * 100);
  const countdown = formatWeekCountdown(weekEndsAt, nowMs);
  const targetSharePercent =
    targetMinutes > 0 ? Math.round((weekMinutes / targetMinutes) * 1000) / 10 : 0;
  const minutesChangePercent =
    previousWeekMinutes !== null && previousWeekMinutes > 0
      ? Math.round(((weekMinutes - previousWeekMinutes) / previousWeekMinutes) * 1000) / 10
      : null;
  const previousWtdMinutes = previousWeekToDateMinutes(previousWeek, nowMs);
  const weekToDateChangePercent =
    previousWtdMinutes !== null && previousWtdMinutes > 0
      ? Math.round(((weekMinutes - previousWtdMinutes) / previousWtdMinutes) * 1000) / 10
      : null;
  const pace = evaluateBaselinePace(weekMinutes, targetMinutes, weekEndsAt, nowMs, targetNoun);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="card space-y-4 p-4" aria-label={ariaLabel}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
          {subtitle ? <p className="text-xs text-secondary">{subtitle}</p> : null}
        </div>
        <p className="text-display text-2xl tabular-nums text-ink">
          {weekMinutes} / {targetMinutes} Min
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-sm border border-border bg-page"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetMinutes}
        aria-valuenow={Math.min(weekMinutes, targetMinutes)}
        aria-label={progressAriaLabel}
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${fillPercent}%` }}
          data-testid={`${testIdPrefix}-fill`}
        />
      </div>

      {weekMinutes === 0 ? (
        <p className="text-sm text-secondary">
          No locked missions this week. Finish a workout and save it to your account — only locked
          scores count.
        </p>
      ) : null}

      <div className="grid gap-3 border-t border-divider pt-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Week to date</p>
          <p
            className="text-display text-lg tabular-nums text-ink"
            data-testid={`${testIdPrefix}-wtd`}
          >
            {weekMinutes} min
          </p>
          <p className="text-xs text-secondary">
            {targetSharePercent}% of {shareNoun}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">WTD vs last week</p>
          {previousWtdMinutes === null ? (
            <>
              <p className="text-display text-lg tabular-nums text-ink">N/A</p>
              <p className="text-xs text-secondary">no prior week-to-date yet</p>
            </>
          ) : (
            <>
              <p
                className={`text-display text-lg tabular-nums ${
                  weekToDateChangePercent !== null && weekToDateChangePercent > 0
                    ? 'text-success-text'
                    : 'text-ink'
                }`}
                data-testid={`${testIdPrefix}-wtd-vs-last-week`}
              >
                {weekToDateChangePercent === null
                  ? formatSignedMinutesDelta(weekMinutes, previousWtdMinutes)
                  : formatSignedPercent(weekToDateChangePercent)}
              </p>
              <p className="text-xs text-secondary">
                {previousWtdMinutes} min by this time last week
              </p>
            </>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Vs last week</p>
          {previousWeekMinutes === null ? (
            <>
              <p className="text-display text-lg tabular-nums text-ink">N/A</p>
              <p className="text-xs text-secondary">no prior week yet</p>
            </>
          ) : (
            <>
              <p
                className={`text-display text-lg tabular-nums ${
                  minutesChangePercent !== null && minutesChangePercent > 0
                    ? 'text-success-text'
                    : 'text-ink'
                }`}
                data-testid={`${testIdPrefix}-vs-last-week`}
              >
                {minutesChangePercent === null
                  ? formatSignedMinutesDelta(weekMinutes, previousWeekMinutes)
                  : formatSignedPercent(minutesChangePercent)}
              </p>
              <p className="text-xs text-secondary">{previousWeekMinutes} min last week</p>
            </>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{paceHeading}</p>
          {pace === null ? (
            <>
              <p className="text-display text-lg tabular-nums text-ink">N/A</p>
              <p className="text-xs text-secondary">{shareNoun} unavailable</p>
            </>
          ) : (
            <>
              <p
                className={`text-display text-lg ${
                  pace.status === 'ahead' || pace.status === 'met'
                    ? 'text-success-text'
                    : pace.status === 'behind'
                      ? 'text-error'
                      : 'text-ink'
                }`}
                data-testid={`${testIdPrefix}-pace`}
              >
                {pace.label}
              </p>
              <p className="text-xs text-secondary">{pace.detail}</p>
            </>
          )}
        </div>
        <div className="space-y-1 lg:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Resets in</p>
          <p className="text-display text-lg tabular-nums text-ink">{countdown}</p>
          <p className="text-xs text-secondary">Monday, local time</p>
        </div>
      </div>
    </section>
  );
}
