import type { TacticalCue } from '@/lib/audio/tacticalSynthesis';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

export interface TacticalClockSnapshot {
  phase: LiveMissionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
}

const PREP_SECONDS = new Set([3, 2, 1]);
const TERMINAL_SECONDS = new Set([5, 4, 3, 2, 1]);

function enteredSetup(prev: TacticalClockSnapshot | null, next: TacticalClockSnapshot): boolean {
  return next.phase === 'setup' && (prev === null || prev.phase !== 'setup');
}

function timeLeftChanged(prev: TacticalClockSnapshot | null, next: TacticalClockSnapshot): boolean {
  if (prev === null) {
    return true;
  }
  return prev.phase !== next.phase || prev.timeLeftSec !== next.timeLeftSec;
}

export function selectTacticalCue(
  prev: TacticalClockSnapshot | null,
  next: TacticalClockSnapshot
): TacticalCue[] {
  if (next.isPaused) {
    return [];
  }

  if (prev?.phase === 'setup' && next.phase === 'work') {
    return ['go'];
  }

  if (prev?.phase === 'work' && next.phase === 'finished') {
    return ['end'];
  }

  const cues: TacticalCue[] = [];

  if (enteredSetup(prev, next)) {
    cues.push('ignition');
  }

  if (next.phase === 'setup' && PREP_SECONDS.has(next.timeLeftSec) && timeLeftChanged(prev, next)) {
    cues.push('prep');
  }

  if (next.phase !== 'work' || !timeLeftChanged(prev, next)) {
    return cues;
  }

  // Joiners landing mid-work should not get a startle cue on first paint.
  if (prev === null || prev.phase !== 'work') {
    return cues;
  }

  if (TERMINAL_SECONDS.has(next.timeLeftSec)) {
    cues.push('terminal');
    return cues;
  }

  if (next.timeLeftSec === 60) {
    cues.push('finalMinute');
    return cues;
  }

  if (
    next.timeLeftSec > 60 &&
    next.timeLeftSec % 60 === 0 &&
    next.timeLeftSec !== next.workDurationSec
  ) {
    cues.push('minute');
  }

  return cues;
}
