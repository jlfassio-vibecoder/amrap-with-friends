import {
  computeAveragePaceSec,
  getPacingDurations,
  shouldExcludeBuyInRound,
} from '@/lib/scoring/getPacingDurations';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import { formatSplitDuration } from '@/lib/sessionSync/computeParticipantSplits';

interface PacingBarChartProps {
  roundSplits: number[];
  durationMinutes: number;
  pvi: number | null;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const PADDING = { top: 12, right: 12, bottom: 28, left: 36 };
const BAR_GAP = 8;

function buildAriaLabel(roundSplits: number[], slowestRound: number): string {
  return `Pacing chart with ${roundSplits.length} rounds. Slowest round was round ${slowestRound}.`;
}

export function PacingBarChart({
  roundSplits,
  durationMinutes,
  pvi,
}: PacingBarChartProps) {
  const excludeBuyIn = shouldExcludeBuyInRound(durationMinutes);
  const pviEligibleDurations = getPacingDurations(roundSplits, {
    excludeFirstRound: excludeBuyIn,
  });
  const averagePaceSec = computeAveragePaceSec(pviEligibleDurations);
  const pviTier = getPviMultiplier(pvi);

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const maxDuration = Math.max(...roundSplits, averagePaceSec ?? 0, 1);
  const barWidth =
    roundSplits.length > 0
      ? (plotWidth - BAR_GAP * (roundSplits.length - 1)) / roundSplits.length
      : 0;

  const slowestIndex = roundSplits.reduce(
    (slowest, duration, index) =>
      duration > roundSplits[slowest] ? index : slowest,
    0
  );

  const redlineY =
    averagePaceSec !== null
      ? PADDING.top + plotHeight - (averagePaceSec / maxDuration) * plotHeight
      : null;

  return (
    <section
      className="space-y-3 rounded-card border border-border bg-page p-4"
      aria-label="Round pacing chart"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            P.V.I. variance
          </p>
          <p className="text-display text-lg tabular-nums text-ink">
            {pvi === null ? 'N/A' : `${pvi}%`}
          </p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {pviTier.classification}
        </p>
        <p className="text-sm leading-snug text-secondary">{pviTier.verdict}</p>
      </div>

      <svg
        role="img"
        aria-label={buildAriaLabel(roundSplits, slowestIndex + 1)}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full text-ink"
      >
        <defs>
          <pattern
            id="buy-in-hatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-border" strokeWidth="2" />
          </pattern>
        </defs>

        <line
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={PADDING.left + plotWidth}
          y2={PADDING.top + plotHeight}
          className="stroke-border"
          strokeWidth="1"
        />

        {redlineY !== null ? (
          <>
            <line
              x1={PADDING.left}
              y1={redlineY}
              x2={PADDING.left + plotWidth}
              y2={redlineY}
              className="stroke-error"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={PADDING.left + plotWidth}
              y={redlineY - 4}
              textAnchor="end"
              className="fill-error text-[10px]"
            >
              Avg {formatSplitDuration(Math.round(averagePaceSec!))}
            </text>
          </>
        ) : null}

        {roundSplits.map((durationSec, index) => {
          const barHeight = (durationSec / maxDuration) * plotHeight;
          const x = PADDING.left + index * (barWidth + BAR_GAP);
          const y = PADDING.top + plotHeight - barHeight;
          const isBuyIn = excludeBuyIn && index === 0;

          return (
            <g key={`round-${index + 1}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={isBuyIn ? 'url(#buy-in-hatch)' : 'currentColor'}
                className={isBuyIn ? 'stroke-border text-muted/40' : 'text-accent'}
                strokeWidth={isBuyIn ? 1 : 0}
                opacity={isBuyIn ? 0.75 : 1}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className={`text-[10px] tabular-nums ${isBuyIn ? 'fill-muted' : 'fill-ink'}`}
              >
                {formatSplitDuration(durationSec)}
              </text>
              <text
                x={x + barWidth / 2}
                y={PADDING.top + plotHeight + 16}
                textAnchor="middle"
                className="fill-secondary text-[10px]"
              >
                {index + 1}
              </text>
              {isBuyIn ? (
                <text
                  x={x + barWidth / 2}
                  y={PADDING.top + plotHeight + 26}
                  textAnchor="middle"
                  className="fill-muted text-[8px] uppercase"
                >
                  Buy-in
                </text>
              ) : null}
            </g>
          );
        })}

        <text
          x={4}
          y={PADDING.top + 8}
          className="fill-muted text-[10px]"
        >
          sec
        </text>
      </svg>
    </section>
  );
}
