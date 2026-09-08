import { useState } from 'react';
import { MissionWidgetBoundary } from '@/components/mission/MissionWidgetBoundary';
import { PacingGauge } from '@/components/mission/PacingGauge';
import { readPacingGaugeEnabled, writePacingGaugeEnabled } from '@/lib/pacing/pacingGaugePrefs';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

interface MissionPacingGaugeProps {
  phase: LiveMissionPhase;
  roundSplitsSec: readonly number[] | null | undefined;
  elapsedSec: number;
  isPaused: boolean;
  isPractice: boolean;
}

/**
 * The pacing gauge and its preference, in one place, mounted beside the mission
 * rather than inside it.
 *
 * The first version of this interleaved a gauge and a checkbox into the clock
 * block — the same element that holds the countdown, Start, Log round and the
 * component that owns the audio cues. Two things went wrong that only go wrong
 * because of where it sat:
 *
 * 1. A focused `<input>` disables the Space hotkey. `isTypingTarget` treats any
 *    focused INPUT as typing, so one tap on the toggle silently stopped Space
 *    logging rounds — and stopped the round-log sound with it — for the rest of
 *    the mission. The toggle now only renders **before** the mission starts,
 *    where no hotkey is bound, so the work phase contains no focusable control
 *    the gauge put there.
 * 2. A render error unmounts everything around it. React tears down the root on
 *    an uncaught error, so a throw here took the clock, both buttons and the
 *    audio effect with it. `MissionWidgetBoundary` stops that at this level.
 *
 * The rule this component exists to enforce: **the gauge may fail, and the
 * mission must not notice.** Nothing here is worth a dead screen mid-workout.
 * Deleting this file and its one mount line removes the feature completely.
 */
export function MissionPacingGauge({
  phase,
  roundSplitsSec,
  elapsedSec,
  isPaused,
  isPractice,
}: MissionPacingGaugeProps) {
  const [enabled, setEnabled] = useState(() => readPacingGaugeEnabled());

  // Before the clock starts: the preference, where Space is not yet a hotkey.
  if (phase === 'waiting' && !isPractice) {
    return (
      <section className="flex justify-center">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--color-accent)]"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              writePacingGaugeEnabled(event.target.checked);
              // Hand focus back. shouldHandleLogRoundHotkey treats any focused
              // INPUT as a typing target, so leaving this checkbox focused
              // silently disables Space for the rest of the mission once work
              // begins — even though the toggle itself is gone from the live view.
              event.target.blur();
            }}
          />
          Pacing gauge during the mission
        </label>
      </section>
    );
  }

  if (phase !== 'work' || !enabled || isPractice) {
    return null;
  }

  return (
    <section className="flex justify-center">
      <MissionWidgetBoundary name="PacingGauge">
        <PacingGauge roundSplitsSec={roundSplitsSec} elapsedSec={elapsedSec} isPaused={isPaused} />
      </MissionWidgetBoundary>
    </section>
  );
}
