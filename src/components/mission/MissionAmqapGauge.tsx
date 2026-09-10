import { MissionWidgetBoundary } from '@/components/mission/MissionWidgetBoundary';
import { AmqapGauge } from '@/components/mission/AmqapGauge';
import type { AmqapFlow } from '@/data/amqapFlows';
import { expandAmqapSets } from '@/lib/amqap/expandAmqapSets';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

interface MissionAmqapGaugeProps {
  phase: LiveMissionPhase;
  flow: AmqapFlow;
  roundSplitsSec: readonly number[] | null | undefined;
  elapsedSec: number;
  isPaused: boolean;
}

/**
 * AMQAP set gauge, mounted beside the mission rather than inside the clock
 * block. Always on during work — including practice. No preference checkbox:
 * this instrument is the protocol, not an optional race pacer.
 *
 * Same isolation rule as the race pacing gauge: the widget may fail, and the
 * mission must not notice.
 */
export function MissionAmqapGauge({
  phase,
  flow,
  roundSplitsSec,
  elapsedSec,
  isPaused,
}: MissionAmqapGaugeProps) {
  if (phase !== 'work') {
    return null;
  }

  const sets = expandAmqapSets(flow);
  if (sets.length === 0) {
    return null;
  }

  return (
    <section className="flex justify-center">
      <MissionWidgetBoundary name="AmqapGauge">
        <AmqapGauge
          sets={sets}
          roundSplitsSec={roundSplitsSec}
          elapsedSec={elapsedSec}
          isPaused={isPaused}
        />
      </MissionWidgetBoundary>
    </section>
  );
}
