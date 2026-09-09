import {
  computePacingGaugeState,
  formatPacingReadout,
  pacingReadoutLabel,
} from '@/lib/pacing/pacingGauge';
import { GAUGE_ZONE_NAME, GaugeDial } from '@/components/mission/GaugeDial';

interface PacingGaugeProps {
  roundSplitsSec: readonly number[] | null | undefined;
  elapsedSec: number;
  /** A paused clock must not keep sweeping the needle. */
  isPaused?: boolean;
  className?: string;
}

/**
 * This round's elapsed time against the benchmark round one set.
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
  const readout = formatPacingReadout(state);
  const readoutLabel = pacingReadoutLabel(state);
  const zoneName = state.isActive ? GAUGE_ZONE_NAME[state.zone] : 'Round 1';

  return (
    <GaugeDial
      ratio={state.ratio}
      zone={state.zone}
      isActive={state.isActive}
      isPaused={isPaused}
      snapNeedle={state.roundElapsedSec === 0}
      readout={readout}
      zoneLabel={state.isActive ? zoneName : readoutLabel}
      ariaLabel={
        state.isActive
          ? `Pacing: ${zoneName}, ${readout} ${readoutLabel}`
          : 'Pacing: round 1 sets the benchmark'
      }
      className={className}
    />
  );
}
