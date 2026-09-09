import { useMemo } from 'react';
import { MAX_RATIO, OPTIMAL_CEILING, type PacingZone } from '@/lib/pacing/pacingGauge';

export const GAUGE_ZONE_NAME: Record<PacingZone, string> = {
  optimal: 'On pace',
  warning: 'At the limit',
  overtime: 'Overtime',
};

const RADIUS = 46;
const CENTRE_X = 56;
const CENTRE_Y = 52;
const SWEEP_DEGREES = 180;

const ZONE_STROKE: Record<PacingZone, string> = {
  optimal: 'var(--color-pace-optimal)',
  warning: 'var(--color-pace-warning)',
  overtime: 'var(--color-pace-overtime)',
};

export interface GaugeDialProps {
  ratio: number;
  zone: PacingZone;
  isActive: boolean;
  isPaused?: boolean;
  /** Drop the 1s sweep — set change, log round, or a paused clock. */
  snapNeedle?: boolean;
  readout: string;
  zoneLabel: string;
  caption?: string;
  ariaLabel: string;
  className?: string;
}

function pointAt(ratio: number, radius: number = RADIUS): { x: number; y: number } {
  const angle = Math.PI - (Math.min(ratio, MAX_RATIO) / MAX_RATIO) * Math.PI;
  return {
    x: CENTRE_X + radius * Math.cos(angle),
    y: CENTRE_Y - radius * Math.sin(angle),
  };
}

function arcPath(fromRatio: number, toRatio: number): string {
  const start = pointAt(fromRatio);
  const end = pointAt(toRatio);
  const spanDegrees = ((toRatio - fromRatio) / MAX_RATIO) * SWEEP_DEGREES;
  const large = spanDegrees > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * Semicircular zone track and needle. The mission clock ticks once a second;
 * the needle interpolates with a 1s linear transition unless `snapNeedle`.
 */
export function GaugeDial({
  ratio,
  zone,
  isActive,
  isPaused = false,
  snapNeedle = false,
  readout,
  zoneLabel,
  caption,
  ariaLabel,
  className,
}: GaugeDialProps) {
  const track = useMemo(
    () => [
      { key: 'optimal' as const, d: arcPath(0, OPTIMAL_CEILING) },
      { key: 'warning' as const, d: arcPath(OPTIMAL_CEILING, 1) },
      { key: 'overtime' as const, d: arcPath(1, MAX_RATIO) },
    ],
    []
  );

  const angle = (Math.min(ratio, MAX_RATIO) / MAX_RATIO) * SWEEP_DEGREES - 90;

  return (
    <figure className={`flex flex-col items-center ${className ?? ''}`} aria-label={ariaLabel}>
      <svg
        viewBox="0 0 112 62"
        className="w-full max-w-[16rem]"
        role="presentation"
        focusable="false"
      >
        {track.map((entry) => (
          <path
            key={entry.key}
            d={entry.d}
            fill="none"
            stroke={ZONE_STROKE[entry.key]}
            strokeWidth={6}
            strokeLinecap="butt"
            opacity={isActive ? 1 : 0.28}
          />
        ))}

        <line
          x1={pointAt(1).x}
          y1={pointAt(1).y}
          x2={pointAt(1, RADIUS - 11).x}
          y2={pointAt(1, RADIUS - 11).y}
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          opacity={0.5}
        />

        {isActive ? (
          <g
            data-testid="pacing-needle"
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: `${CENTRE_X}px ${CENTRE_Y}px`,
              transition: isPaused || snapNeedle ? 'none' : 'transform 1s linear',
            }}
          >
            <line
              x1={CENTRE_X}
              y1={CENTRE_Y}
              x2={CENTRE_X}
              y2={CENTRE_Y - RADIUS + 2}
              stroke="var(--color-ink)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>
        ) : null}

        <circle cx={CENTRE_X} cy={CENTRE_Y} r={3.5} fill="var(--color-ink)" />
      </svg>

      <figcaption className="flex flex-col items-center gap-0.5 text-center">
        <span className="flex items-baseline gap-2">
          <span
            className="text-display text-xl tabular-nums"
            style={{ color: isActive ? ZONE_STROKE[zone] : 'var(--color-muted)' }}
          >
            {readout}
          </span>
          <span className="text-xs text-secondary">{zoneLabel}</span>
        </span>
        {caption ? <span className="text-xs text-secondary">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}
