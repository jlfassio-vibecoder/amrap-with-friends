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
  /** True during the yellow exercise-switch buffer before work starts. */
  isSwitchBuffer: boolean;
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

/** Buffer plus work — the span the needle sweeps and the walker consumes. */
export function amqapSetSpanSec(set: AmqapSet): number {
  const buffer = set.leadBufferSec > 0 ? set.leadBufferSec : 0;
  const work = set.durationSec > 0 ? set.durationSec : 0;
  return buffer + work;
}

/**
 * Walk every set except the last, consuming buffer + work exactly. Mid-sets
 * never enter overtime — at 1.0 the index advances and the needle is 0. The
 * last set stays; overtime is seconds past that full span.
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
    const span = amqapSetSpanSec(set);
    if (span <= 0) {
      continue;
    }
    if (remaining < span) {
      return progressForSet({
        setIndex: index,
        set,
        setElapsedSec: remaining,
        isLastSet: false,
      });
    }
    remaining -= span;
  }

  const lastIndex = sets.length - 1;
  return progressForSet({
    setIndex: lastIndex,
    set: sets[lastIndex],
    setElapsedSec: remaining,
    isLastSet: true,
  });
}

function progressForSet(input: {
  setIndex: number;
  set: AmqapSet;
  setElapsedSec: number;
  isLastSet: boolean;
}): AmqapSetProgress {
  const { setIndex, set, setElapsedSec, isLastSet } = input;
  const leadBufferSec = set.leadBufferSec > 0 ? set.leadBufferSec : 0;
  const workSec = set.durationSec > 0 ? set.durationSec : 0;
  const benchmarkSec = amqapSetSpanSec(set);
  const isSwitchBuffer = leadBufferSec > 0 && setElapsedSec < leadBufferSec;
  const rawRatio = benchmarkSec > 0 ? setElapsedSec / benchmarkSec : 0;

  let zone: PacingZone;
  let overtimeSec = 0;
  if (isSwitchBuffer) {
    zone = 'warning';
  } else if (workSec <= 0) {
    zone = zoneForRatio(isLastSet ? rawRatio : Math.min(1, rawRatio));
    overtimeSec = isLastSet ? Math.max(0, setElapsedSec - benchmarkSec) : 0;
  } else {
    const workElapsed = Math.max(0, setElapsedSec - leadBufferSec);
    const workRatio = workElapsed / workSec;
    const ratioForZone = isLastSet ? workRatio : Math.min(1, workRatio);
    zone = zoneForRatio(ratioForZone);
    overtimeSec = isLastSet ? Math.max(0, workElapsed - workSec) : 0;
  }

  return {
    setIndex,
    set,
    setElapsedSec,
    benchmarkSec,
    ratio: Math.min(MAX_RATIO, rawRatio),
    zone,
    overtimeSec,
    isLastSet,
    isActive: true,
    isSwitchBuffer,
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
