import { useMemo } from 'react';
import {
  MAX_RATIO,
  OPTIMAL_CEILING,
  computePacingGaugeState,
  formatPacingReadout,
  pacingReadoutLabel,
  type PacingZone,
} from '@/lib/pacing/pacingGauge';

interface PacingGaugeProps {
  roundSplitsSec: readonly number[];
  elapsedSec: number;
  /** A paused clock must not keep sweeping the needle. */
  isPaused?: boolean;
  className?: string;
}

/** Arc geometry: a 180° sweep, drawn once and never animated. */
const RADIUS = 46;
const CENTRE_X = 56;
const CENTRE_Y = 52;
const SWEEP_DEGREES = 180;

const ZONE_STROKE: Record<PacingZone, string> = {
  optimal: 'var(--color-pace-optimal)',
  warning: 'var(--color-pace-warning)',
  overtime: 'var(--color-pace-overtime)',
};

const ZONE_NAME: Record<PacingZone, string> = {
  optimal: 'On pace',
  warning: 'At the limit',
  overtime: 'Overtime',
};

/** Ratio → a point on the arc. 0 is hard left, MAX_RATIO hard right. */
function pointAt(ratio: number): { x: number; y: number } {
  const angle = Math.PI - (Math.min(ratio, MAX_RATIO) / MAX_RATIO) * Math.PI;
  return {
    x: CENTRE_X + RADIUS * Math.cos(angle),
    y: CENTRE_Y - RADIUS * Math.sin(angle),
  };
}

function arcPath(fromRatio: number, toRatio: number): string {
  const start = pointAt(fromRatio);
  const end = pointAt(toRatio);
  const large = (toRatio - fromRatio) / MAX_RATIO > 0.5 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * This round's elapsed time against the benchmark round one set.
 *
 * **Performance.** The mission clock ticks once a second, so the gauge is given
 * one style change per second and the browser interpolates the rest: a single
 * `transform: rotate()` on the needle with a one-second linear transition. The
 * zone track is static — drawn once, never re-rendered — so nothing in the
 * animation path touches React or repaints a path. That is also why the needle
 * carries the motion rather than a growing arc: a `stroke-dashoffset` sweep
 * would repaint geometry every frame for the same information.
 *
 * The transition is dropped on a reset and while paused, so logging a round
 * snaps the needle back to zero instead of sweeping backwards through the
 * zones, and a paused clock does not keep moving.
 *
 * **Colour is never the message.** The zone is named in words and the readout
 * gives the exact seconds, so the gauge still reads with the colours removed —
 * which the palette's own contrast result requires, and which matters most for
 * the athletes the green/amber/red convention serves worst.
 */
export function PacingGauge({
  roundSplitsSec,
  elapsedSec,
  isPaused = false,
  className,
}: PacingGaugeProps) {
  const state = computePacingGaugeState({ roundSplitsSec, elapsedSec });

  // The track never changes, so it is built once per mount rather than per tick.
  const track = useMemo(
    () => [
      { key: 'optimal' as const, d: arcPath(0, OPTIMAL_CEILING) },
      { key: 'warning' as const, d: arcPath(OPTIMAL_CEILING, 1) },
      { key: 'overtime' as const, d: arcPath(1, MAX_RATIO) },
    ],
    []
  );

  const angle = (Math.min(state.ratio, MAX_RATIO) / MAX_RATIO) * SWEEP_DEGREES - 90;
  const readout = formatPacingReadout(state);
  const readoutLabel = pacingReadoutLabel(state);
  const zoneName = state.isActive ? ZONE_NAME[state.zone] : 'Round 1';

  return (
    <figure
      className={`flex flex-col items-center ${className ?? ''}`}
      aria-label={
        state.isActive
          ? `Pacing: ${zoneName}, ${readout} ${readoutLabel}`
          : 'Pacing: round 1 sets the benchmark'
      }
    >
      <svg
        viewBox="0 0 112 62"
        className="w-full max-w-[16rem]"
        role="presentation"
        focusable="false"
      >
        {track.map((zone) => (
          <path
            key={zone.key}
            d={zone.d}
            fill="none"
            stroke={ZONE_STROKE[zone.key]}
            strokeWidth={6}
            strokeLinecap="butt"
            // Dimmed until there is a benchmark, so the gauge does not imply a
            // reading it cannot yet make.
            opacity={state.isActive ? 1 : 0.28}
          />
        ))}

        {/* The benchmark itself: the mark the needle is racing. */}
        <line
          x1={pointAt(1).x}
          y1={pointAt(1).y}
          x2={CENTRE_X + (RADIUS - 11) * Math.cos(Math.PI - Math.PI / MAX_RATIO)}
          y2={CENTRE_Y - (RADIUS - 11) * Math.sin(Math.PI - Math.PI / MAX_RATIO)}
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          opacity={0.5}
        />

        {state.isActive ? (
          <g
            data-testid="pacing-needle"
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: `${CENTRE_X}px ${CENTRE_Y}px`,
              // No easing on a reset: the needle should snap to zero when a
              // round is logged, not sweep back through the zones it just left.
              transition: isPaused || state.roundElapsedSec === 0 ? 'none' : 'transform 1s linear',
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

      <figcaption className="flex items-baseline gap-2 text-center">
        <span
          className="text-display text-xl tabular-nums"
          style={{ color: state.isActive ? ZONE_STROKE[state.zone] : 'var(--color-muted)' }}
        >
          {readout}
        </span>
        <span className="text-xs text-secondary">{state.isActive ? zoneName : readoutLabel}</span>
      </figcaption>
    </figure>
  );
}
