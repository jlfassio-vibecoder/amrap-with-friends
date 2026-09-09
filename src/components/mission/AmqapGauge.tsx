import type { AmqapSet } from '@/lib/amqap/expandAmqapSets';
import {
  amqapReadoutLabel,
  elapsedInRoundSec,
  formatAmqapReadout,
  formatAmqapSetCaption,
  setProgressFromRoundElapsed,
} from '@/lib/amqap/amqapSetGauge';
import { GAUGE_ZONE_NAME, GaugeDial } from '@/components/mission/GaugeDial';

interface AmqapGaugeProps {
  sets: readonly AmqapSet[];
  roundSplitsSec: readonly number[] | null | undefined;
  elapsedSec: number;
  isPaused?: boolean;
  className?: string;
}

/**
 * Pre-programmed set gauge: the needle resets when a set's duration elapses,
 * except on the last set of the last exercise, where it continues through red
 * until the athlete logs the quality round.
 */
export function AmqapGauge({
  sets,
  roundSplitsSec,
  elapsedSec,
  isPaused = false,
  className,
}: AmqapGaugeProps) {
  const progress = setProgressFromRoundElapsed(elapsedInRoundSec(elapsedSec, roundSplitsSec), sets);

  if (!progress) {
    return null;
  }

  const readout = formatAmqapReadout(progress);
  const readoutLabel = amqapReadoutLabel(progress);
  const zoneName = progress.isSwitchBuffer ? 'Switch' : GAUGE_ZONE_NAME[progress.zone];
  const caption = formatAmqapSetCaption(progress.set);
  const leadWarningRatio =
    progress.set.leadBufferSec > 0 && progress.benchmarkSec > 0
      ? progress.set.leadBufferSec / progress.benchmarkSec
      : 0;

  return (
    <GaugeDial
      ratio={progress.ratio}
      zone={progress.zone}
      isActive
      isPaused={isPaused}
      snapNeedle={progress.setElapsedSec === 0}
      readout={readout}
      zoneLabel={zoneName}
      caption={caption}
      leadWarningRatio={leadWarningRatio}
      ariaLabel={`Quality set: ${caption}, ${zoneName}, ${readout} ${readoutLabel}`}
      className={className}
    />
  );
}
