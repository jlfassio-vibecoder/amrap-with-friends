import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import { baselineFillPercent, formatWeekRangeLabel } from '@/lib/hud/weekHistory';
import type { HudHistoryWeek } from '@/lib/hud/types';

interface WeekDetailPanelProps {
  week: HudHistoryWeek;
  /** True when this is the week in progress, which reads differently from a finished one. */
  isCurrent: boolean;
  baselineMinutes: number;
  canStepOlder: boolean;
  canStepNewer: boolean;
  onStepOlder: () => void;
  onStepNewer: () => void;
  onJumpToCurrent: () => void;
  onClose: () => void;
}

const STEP_BUTTON =
  'rounded-card border border-border bg-surface px-2.5 py-1 text-sm text-ink hover:bg-accent-tint disabled:opacity-40';

/**
 * One inspected week, opened from the attrition strip.
 *
 * Deliberately the only part of the HUD that moves in time. The live cards
 * above it — time since last mission, overtraining risk, benchmarks due —
 * stay pinned to now, because an alert rendered for a week eight weeks gone
 * is not an alert, and putting the whole page in a time machine would have
 * meant faking them or hiding them as the athlete steps back.
 */
export function WeekDetailPanel({
  week,
  isCurrent,
  baselineMinutes,
  canStepOlder,
  canStepNewer,
  onStepOlder,
  onStepNewer,
  onJumpToCurrent,
  onClose,
}: WeekDetailPanelProps) {
  const fillPercent = baselineFillPercent(week.minutes, baselineMinutes);

  return (
    <section className="card space-y-4 p-4" aria-label="Week detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {isCurrent ? 'This week' : 'Week of'}
          </p>
          <h3 className="text-display text-lg text-ink">{formatWeekRangeLabel(week.weekStart)}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={onStepOlder}
            disabled={!canStepOlder}
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={onStepNewer}
            disabled={!canStepNewer}
            aria-label="Next week"
          >
            ›
          </button>
          {!isCurrent ? (
            <button
              type="button"
              className="rounded-card border border-border bg-surface px-2.5 py-1 text-xs text-secondary hover:bg-accent-tint hover:text-ink"
              onClick={onJumpToCurrent}
            >
              This week
            </button>
          ) : null}
          <button
            type="button"
            className="px-1.5 text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close week detail"
          >
            Close
          </button>
        </div>
      </div>

      {week.missionCount === 0 ? (
        <p className="text-sm text-secondary">
          {isCurrent
            ? 'Nothing locked yet this week.'
            : 'No locked missions this week — a rest week, or one that never got saved to your account.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-card border border-border bg-page p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Minutes</p>
              <p className="text-display text-xl tabular-nums text-ink">{week.minutes}</p>
            </div>
            <div className="rounded-card border border-border bg-page p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Score</p>
              <p className="text-display text-xl tabular-nums text-accent">{week.score}</p>
            </div>
            <div className="rounded-card border border-border bg-page p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">P.V.I.</p>
              <p className="text-display text-xl tabular-nums text-ink">
                {week.pviAverage === null ? 'N/A' : `${week.pviAverage}%`}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <p className="font-medium uppercase tracking-wide text-muted">Against baseline</p>
              <p className="tabular-nums text-secondary">
                {week.minutes} / {baselineMinutes} min
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-sm border border-border bg-page"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={baselineMinutes}
              aria-valuenow={Math.min(week.minutes, baselineMinutes)}
              aria-label="Minutes toward the weekly baseline"
            >
              <div
                className={week.compliant ? 'h-full bg-accent' : 'h-full bg-muted'}
                style={{ width: `${fillPercent}%` }}
                data-testid="week-detail-baseline-fill"
              />
            </div>
          </div>

          <ul className="space-y-1.5 text-sm">
            {week.missions.map((mission) => (
              <li
                key={mission.missionId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-divider pt-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-ink">
                  {resolveWorkoutTitle(mission.templateId)}
                </span>
                <span className="shrink-0 tabular-nums text-secondary">
                  {mission.durationMinutes} min
                </span>
                <span className="shrink-0 tabular-nums text-secondary">
                  {mission.pvi === null ? 'N/A' : `${mission.pvi}%`}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {mission.finalScore === null ? '—' : mission.finalScore}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
