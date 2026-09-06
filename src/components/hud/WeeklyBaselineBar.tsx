import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { HudInfoDisclosure } from '@/components/hud/HudInfoDisclosure';
import { describeWeeklyPviGuidance } from '@/lib/scoring/pviGuidance';
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
  const pvi = describeWeeklyPviGuidance(weekPviAverage);
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
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Weekly baseline · since Monday
        </p>
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
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Week pacing spread
            </p>
            <HudInfoDisclosure label="week pacing spread">
              <p>
                Every mission gets a pacing score:{' '}
                <span className="font-semibold text-ink">
                  (slowest round − fastest round) ÷ average round
                </span>
                , as a percentage. This is the average across the missions you locked this week.
                Lower is more even.
              </p>
              <p>
                Rounds are never compared between missions. A two-minute round in a 20-minute AMRAP
                is measured only against the other rounds of that same mission, and only the
                resulting percentages are averaged here.
              </p>
              <p>
                Each mission carries its own band — Elite Pacing, Standard, Power Leak, System
                Failure — which adjusts that mission&apos;s score. Those bands belong to a single
                mission, so this weekly average deliberately does not wear one: it would announce a
                failure that might belong to one workout out of six, without saying which.
              </p>
              <p>
                Except on the shortest missions — five minutes and under — the first round is left
                out, because everyone&apos;s opening round is fast and counting it would mark honest
                pacing as a collapse. Short missions therefore read a little higher here, and they
                have fewer rounds, so one slow round moves them further.
              </p>
              <p>
                Those four cut-offs are our own coaching judgement, not a published standard. No
                study has validated them against AMRAP performance.{' '}
                <AppLink className="link-accent" to="/science/pacing">
                  What the research does say
                </AppLink>
                .
              </p>
            </HudInfoDisclosure>
          </div>
          <p className="text-display text-lg tabular-nums text-ink">
            {weekPviAverage === null ? 'N/A' : `${weekPviAverage}%`}
          </p>
          <p className="text-xs text-secondary">average of this week&apos;s missions</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Resets in</p>
          <p className="text-display text-lg tabular-nums text-ink">{countdown}</p>
          <p className="text-xs text-secondary">Monday, local time</p>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-secondary">{pvi.meaning}</p>
        {pvi.cause ? <p className="text-secondary">{pvi.cause}</p> : null}
        {pvi.fix ? (
          <p className="text-ink">
            <span className="font-semibold">Do this: </span>
            {pvi.fix}
          </p>
        ) : null}
      </div>
    </section>
  );
}
