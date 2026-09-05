import { useState } from 'react';
import type { CoachGuestBrowsersPoint } from '@/lib/api/coach';
import {
  formatGuestBrowsersBucket,
  guestBrowsersCountLabel,
  type GuestBrowsersGrain,
} from '@/lib/coach/guestBrowsersWindows';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 12, bottom: 32, left: 36 };
const BAR_GAP = 2;
const MAX_BAR_POINTS = 90;

function buildAriaLabel(points: CoachGuestBrowsersPoint[], grain: GuestBrowsersGrain): string {
  const max = points.reduce((peak, point) => Math.max(peak, point.count), 0);
  return `Guest browsers ${grain === 'hour' ? 'hourly' : 'daily'} chart with ${points.length} buckets. Peak was ${max}.`;
}

interface CoachGuestBrowsersChartProps {
  points: CoachGuestBrowsersPoint[];
  grain: GuestBrowsersGrain;
  notesByBucket?: Record<string, string>;
  selectedBucketStart?: string | null;
  onSelectBucket?: (bucketStart: string) => void;
  onHoverBucket?: (bucketStart: string | null) => void;
}

export function CoachGuestBrowsersChart({
  points,
  grain,
  notesByBucket = {},
  selectedBucketStart = null,
  onSelectBucket,
  onHoverBucket,
}: CoachGuestBrowsersChartProps) {
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const useBars = points.length > 0 && points.length <= MAX_BAR_POINTS;
  const interactive = useBars && Boolean(onSelectBucket);
  const allZero = points.length === 0 || points.every((point) => point.count === 0);

  if (allZero) {
    return (
      <p className="text-sm text-secondary" data-testid="guest-browsers-chart-empty">
        No guest browser activity in this range.
      </p>
    );
  }

  const barWidth =
    useBars && points.length > 0 ? (plotWidth - BAR_GAP * (points.length - 1)) / points.length : 0;

  const linePoints = points
    .map((point, index) => {
      const x =
        points.length === 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (points.length - 1)) * plotWidth;
      const y = PADDING.top + plotHeight - (point.count / maxCount) * plotHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const hoveredPoint = points.find((point) => point.bucketStart === hoveredBucket) ?? null;
  const hoveredIndex = hoveredPoint
    ? points.findIndex((point) => point.bucketStart === hoveredPoint.bucketStart)
    : -1;
  const tooltipLeftPct =
    hoveredIndex >= 0 && useBars
      ? ((PADDING.left + hoveredIndex * (barWidth + BAR_GAP) + barWidth / 2) / CHART_WIDTH) * 100
      : 0;

  function setHover(bucketStart: string | null) {
    setHoveredBucket(bucketStart);
    onHoverBucket?.(bucketStart);
  }

  return (
    <div
      className="relative"
      data-testid="guest-browsers-chart-wrap"
      onMouseLeave={() => setHover(null)}
    >
      <svg
        role="img"
        aria-label={buildAriaLabel(points, grain)}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full text-ink"
        data-testid="guest-browsers-chart"
      >
        <line
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={PADDING.left + plotWidth}
          y2={PADDING.top + plotHeight}
          className="stroke-border"
          strokeWidth="1"
        />
        <text x={4} y={PADDING.top + 8} className="fill-muted text-[10px]">
          guests
        </text>
        <text x={4} y={PADDING.top + 20} className="fill-muted text-[10px] tabular-nums">
          {maxCount}
        </text>

        {useBars
          ? points.map((point, index) => {
              const barHeight = (point.count / maxCount) * plotHeight;
              const x = PADDING.left + index * (barWidth + BAR_GAP);
              const y = PADDING.top + plotHeight - barHeight;
              const width = Math.max(barWidth, 1);
              const hasNote = Boolean(notesByBucket[point.bucketStart]);
              const selected = selectedBucketStart === point.bucketStart;
              const countLabel = guestBrowsersCountLabel(point.count, grain);
              const note = notesByBucket[point.bucketStart];
              const title = note ? `${countLabel}. ${note}` : countLabel;

              return (
                <g key={point.bucketStart}>
                  {interactive ? (
                    <rect
                      x={x}
                      y={PADDING.top}
                      width={width}
                      height={plotHeight}
                      className="fill-transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={title}
                      aria-pressed={selected}
                      data-testid={`guest-browsers-bar-${point.bucketStart}`}
                      data-has-note={hasNote ? 'true' : 'false'}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHover(point.bucketStart)}
                      onFocus={() => setHover(point.bucketStart)}
                      onClick={() => onSelectBucket?.(point.bucketStart)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectBucket?.(point.bucketStart);
                        }
                      }}
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={Math.max(barHeight, point.count > 0 ? 1 : 0)}
                    rx="1"
                    className={selected ? 'fill-accent stroke-ink' : 'fill-accent'}
                    strokeWidth={selected ? 1.5 : 0}
                    pointerEvents="none"
                  />
                  {hasNote ? (
                    <circle
                      cx={x + width / 2}
                      cy={Math.max(y - 6, PADDING.top + 4)}
                      r="3"
                      className="fill-ink"
                      pointerEvents="none"
                      data-testid={`guest-browsers-note-marker-${point.bucketStart}`}
                    />
                  ) : null}
                  {index % labelStep === 0 ? (
                    <text
                      x={x + barWidth / 2}
                      y={PADDING.top + plotHeight + 16}
                      textAnchor="middle"
                      className="fill-secondary text-[9px]"
                      pointerEvents="none"
                    >
                      {formatGuestBrowsersBucket(point.bucketStart, grain)}
                    </text>
                  ) : null}
                </g>
              );
            })
          : null}

        {!useBars ? (
          <>
            <polyline
              fill="none"
              points={linePoints}
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) => {
              if (index % labelStep !== 0 && index !== points.length - 1) {
                return null;
              }
              const x =
                points.length === 1
                  ? PADDING.left + plotWidth / 2
                  : PADDING.left + (index / (points.length - 1)) * plotWidth;
              return (
                <text
                  key={point.bucketStart}
                  x={x}
                  y={PADDING.top + plotHeight + 16}
                  textAnchor="middle"
                  className="fill-secondary text-[9px]"
                >
                  {formatGuestBrowsersBucket(point.bucketStart, grain)}
                </text>
              );
            })}
          </>
        ) : null}
      </svg>

      {hoveredPoint ? (
        <div
          role="tooltip"
          data-testid="guest-browsers-tooltip"
          className="pointer-events-none absolute z-10 max-w-[14rem] -translate-x-1/2 rounded-md border border-border bg-page px-2 py-1.5 text-xs text-ink shadow-sm"
          style={{
            left: `${tooltipLeftPct}%`,
            top: 8,
          }}
        >
          <p className="font-semibold tabular-nums">
            {guestBrowsersCountLabel(hoveredPoint.count, grain)}
          </p>
          {notesByBucket[hoveredPoint.bucketStart] ? (
            <p className="mt-1 line-clamp-3 text-secondary">
              {notesByBucket[hoveredPoint.bucketStart]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
