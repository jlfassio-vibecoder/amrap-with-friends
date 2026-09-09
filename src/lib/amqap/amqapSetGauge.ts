import type { AmqapSet } from '@/lib/amqap/expandAmqapSets';
import {
  MAX_RATIO,
  formatPacingReadout,
  zoneForRatio,
  type PacingGaugeState,
  type PacingZone,
} from '@/lib/pacing/pacingGauge';

export interface AmqapSetProgress {
  setIndex: number;
  set: AmqapSet;
  setElapsedSec: number;
  benchmarkSec: number;
  ratio: number;
  zone: PacingZone;
  overtimeSec: number;
  isLastSet: boolean;
  isActive: boolean;
}

/** Seconds into the current quality pass, from the last logged split (or zero). */
export function elapsedInRoundSec(
  elapsedSec: number,
  roundSplitsSec: readonly number[] | null | undefined
): number {
  const splits = Array.isArray(roundSplitsSec) ? roundSplitsSec : [];
  const lastSplit = splits[splits.length - 1] ?? 0;
  const elapsed = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  // A joiner's split can arrive a tick before their clock catches up.
  return Math.max(0, elapsed - lastSplit);
}

/**
 * Walk every set except the last, consuming `durationSec` exactly. Mid-sets
 * never enter overtime — at 1.0 the index advances and the needle is 0. The
 * last set stays; overtime is seconds past its programmed duration.
 */
export function setProgressFromRoundElapsed(
  elapsedInRound: number,
  sets: readonly AmqapSet[]
): AmqapSetProgress | null {
  if (sets.length === 0) {
    return null;
  }

  let remaining = Number.isFinite(elapsedInRound) ? Math.max(0, elapsedInRound) : 0;

  for (let index = 0; index < sets.length - 1; index += 1) {
    const set = sets[index];
    const duration = set.durationSec > 0 ? set.durationSec : 0;
    if (duration <= 0) {
      continue;
    }
    if (remaining < duration) {
      return progressForSet({
        setIndex: index,
        set,
        setElapsedSec: remaining,
        benchmarkSec: duration,
        isLastSet: false,
      });
    }
    remaining -= duration;
  }

  const lastIndex = sets.length - 1;
  const last = sets[lastIndex];
  const duration = last.durationSec > 0 ? last.durationSec : 0;
  return progressForSet({
    setIndex: lastIndex,
    set: last,
    setElapsedSec: remaining,
    benchmarkSec: duration,
    isLastSet: true,
  });
}

function progressForSet(input: {
  setIndex: number;
  set: AmqapSet;
  setElapsedSec: number;
  benchmarkSec: number;
  isLastSet: boolean;
}): AmqapSetProgress {
  const { setIndex, set, setElapsedSec, benchmarkSec, isLastSet } = input;
  const rawRatio = benchmarkSec > 0 ? setElapsedSec / benchmarkSec : 0;
  // Mid-sets are capped at the benchmark so they cannot read as overtime even
  // if a caller hands us a duration of 0 and leftover time.
  const ratioForZone = isLastSet ? rawRatio : Math.min(1, rawRatio);

  return {
    setIndex,
    set,
    setElapsedSec,
    benchmarkSec,
    ratio: Math.min(MAX_RATIO, rawRatio),
    zone: zoneForRatio(ratioForZone),
    overtimeSec: isLastSet ? Math.max(0, setElapsedSec - benchmarkSec) : 0,
    isLastSet,
    isActive: true,
  };
}

export function amqapProgressToPacingState(progress: AmqapSetProgress): PacingGaugeState {
  return {
    benchmarkSec: progress.benchmarkSec,
    roundElapsedSec: progress.setElapsedSec,
    ratio: progress.ratio,
    zone: progress.zone,
    overtimeSec: progress.overtimeSec,
    isActive: progress.isActive,
  };
}

export function formatAmqapSetCaption(set: AmqapSet): string {
  if (set.side === 'left') {
    return `${set.movementName} · Left side`;
  }
  if (set.side === 'right') {
    return `${set.movementName} · Right side`;
  }
  return set.movementName;
}

/** Side, programmed duration, and ~reps when the instruction is a rep count. */
export function formatAmqapActiveExerciseDetail(set: AmqapSet): string {
  const parts: string[] = [];
  if (set.side === 'left') {
    parts.push('Left side');
  } else if (set.side === 'right') {
    parts.push('Right side');
  }
  if (set.durationSec > 0) {
    parts.push(`${set.durationSec} sec`);
  }
  if (set.repsPerSet != null && set.repsPerSet > 0) {
    parts.push(`~${set.repsPerSet} ${set.repsPerSet === 1 ? 'rep' : 'reps'}`);
  }
  return parts.join(' · ');
}

export function formatAmqapReadout(progress: AmqapSetProgress): string {
  return formatPacingReadout(amqapProgressToPacingState(progress));
}

export function amqapReadoutLabel(progress: AmqapSetProgress): string {
  return progress.overtimeSec > 0 ? 'past this set' : 'left of this set';
}
