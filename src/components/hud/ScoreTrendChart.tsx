import { HudInfoDisclosure } from '@/components/hud/HudInfoDisclosure';
import {
  isIntensityShiftWeek,
  niceCeiling,
  summarizeScoreTrend,
  type ScoreTrendWeek,
} from '@/lib/hud/scoreTrend';

interface ScoreTrendChartProps {
  weeks: ScoreTrendWeek[];
  /** Data-order index of the week currently open in Week detail (oldest = 0). */
  selectedIndex?: number | null;
  /** When true, omit the outer card chrome (parent owns the card). */
  embedded?: boolean;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 150;
const PADDING = { top: 22, right: 4, bottom: 22, left: 34 };
const BAR_WIDTH = 20;

function formatWeekLabel(weekStartIso: string): string {
  return new Date(weekStartIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A y-axis tick value, to one decimal, without a forced trailing zero.
 * `Math.round` alone collapses the midline into the same label as an
 * adjacent tick whenever the ceiling is small (ceiling 1 → midline 0.5
 * rounds to "1", the same as the top tick) — two gridlines that read the
 * same number.
 */
function formatTickValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** A bar rounded on its top two corners, square at the baseline — never a plain rect. */
function roundedTopBarPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  if (radius <= 0) {
    return `M ${x} ${y + height} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} Z`;
  }
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ');
}

function formatSignedPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

/**
 * Weekly accumulated Final score, the one HUD figure that folds pacing and
 * clock length into a single number — see `scoreStatGuidance.ts`'s "Final
 * score" entry for the formula. Week detail owns the per-week minutes breakdown;
 * this chart is the glanceable score context above Attrition.
 */
export function ScoreTrendChart({
  weeks,
  selectedIndex = null,
  embedded = false,
}: ScoreTrendChartProps) {
  const summary = summarizeScoreTrend(weeks);
  const hasAnyMissions = weeks.some((week) => week.missionCount > 0);
  const ceiling = niceCeiling(Math.max(...weeks.map((week) => week.totalScore), 1));

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const bandWidth = weeks.length > 0 ? plotWidth / weeks.length : plotWidth;

  const gridlineValues = [0, ceiling / 2, ceiling];
  // At 12 weeks a date label per band would overlap its neighbours, so thin
  // them to at most eight — counted back from the current week, so that one
  // is always labelled and the kept labels stay evenly spaced.
  const labelStride = Math.max(1, Math.ceil(weeks.length / 8));
  const intensityShift =
    summary !== null ? isIntensityShiftWeek(summary.currentWeek, summary.previousWeek) : false;

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Score trend · last {weeks.length} weeks
        </p>
        <HudInfoDisclosure label="score trend">
          <p>
            Every locked mission earns a <span className="font-semibold text-ink">Final score</span>{' '}
            — base reps, adjusted by how evenly you paced it and how long the clock ran. This totals
            that score across all your locked missions each week.
          </p>
          <p>
            Use Attrition below to open a week and inspect minutes, pacing, and missions. A rising
            bar with flat training time means you trained harder in the same clock, not just more.
          </p>
        </HudInfoDisclosure>
      </div>

      {!hasAnyMissions ? (
        <p className="text-sm text-secondary">
          No locked missions yet. Finish a mission and save it to your account to start this trend.
        </p>
      ) : (
        <>
          {summary ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  This week&apos;s score
                </p>
                <p className="text-display text-2xl tabular-nums text-accent">
                  {summary.currentWeek.totalScore}
                </p>
              </div>
              {summary.scoreChangePercent !== null ? (
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    summary.scoreChangePercent > 0 ? 'text-success-text' : 'text-secondary'
                  }`}
                >
                  {formatSignedPercent(summary.scoreChangePercent)} vs last week
                </p>
              ) : null}
            </div>
          ) : null}

          <svg
            role="img"
            aria-label={`Weekly score for the last ${weeks.length} weeks`}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-auto max-h-[200px] w-full"
          >
            {gridlineValues.map((value) => {
              const y = PADDING.top + plotHeight - (value / ceiling) * plotHeight;
              return (
                <g key={value}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={PADDING.left + plotWidth}
                    y2={y}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                  <text
                    x={PADDING.left - 6}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted text-[8px] tabular-nums"
                  >
                    {formatTickValue(value)}
                  </text>
                </g>
              );
            })}

            {weeks.map((week, index) => {
              const isCurrentWeek = index === weeks.length - 1;
              const isSelected = selectedIndex === index;
              const barHeight = ceiling > 0 ? (week.totalScore / ceiling) * plotHeight : 0;
              const bandX = PADDING.left + index * bandWidth;
              const barX = bandX + (bandWidth - BAR_WIDTH) / 2;
              const barY = PADDING.top + plotHeight - barHeight;
              const dimOthers = selectedIndex !== null && selectedIndex !== undefined;

              return (
                <g key={week.weekStart}>
                  {week.totalScore > 0 ? (
                    <path
                      d={roundedTopBarPath(barX, barY, BAR_WIDTH, barHeight)}
                      className="fill-accent"
                      opacity={dimOthers && !isSelected ? 0.35 : 1}
                      data-testid={isSelected ? 'score-trend-selected-bar' : undefined}
                    >
                      <title>
                        {formatWeekLabel(week.weekStart)}: {week.totalScore} pts ·{' '}
                        {week.totalMinutes} min ·{' '}
                        {week.missionCount === 1 ? '1 mission' : `${week.missionCount} missions`}
                      </title>
                    </path>
                  ) : null}
                  {isSelected ? (
                    <rect
                      x={bandX + 1}
                      y={PADDING.top}
                      width={Math.max(0, bandWidth - 2)}
                      height={plotHeight}
                      className="fill-transparent stroke-ink"
                      strokeWidth={1.5}
                      opacity={0.55}
                      data-testid="score-trend-selected-band"
                    />
                  ) : null}
                  {(isCurrentWeek || isSelected) && week.totalScore > 0 ? (
                    <text
                      x={barX + BAR_WIDTH / 2}
                      y={barY - 5}
                      textAnchor="middle"
                      className="fill-ink text-[9px] font-semibold tabular-nums"
                    >
                      {week.totalScore}
                    </text>
                  ) : null}
                  {(weeks.length - 1 - index) % labelStride === 0 ? (
                    <text
                      x={bandX + bandWidth / 2}
                      y={PADDING.top + plotHeight + 12}
                      textAnchor="middle"
                      className="fill-secondary text-[8px]"
                    >
                      {formatWeekLabel(week.weekStart)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {intensityShift ? (
            <p className="rounded-card border border-border bg-accent-tint p-3 text-sm text-ink">
              <span className="font-semibold">Same time, different intensity: </span>
              About the same minutes as last week, but the score moved. That&apos;s pacing or volume
              changing, not the clock.
            </p>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4" aria-label="Score trend">
        {body}
      </div>
    );
  }

  return (
    <section className="card space-y-4 p-4" aria-label="Score trend">
      {body}
    </section>
  );
}
