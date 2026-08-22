import { DEFAULT_SETUP_DURATION_SEC } from '@/lib/amrapTimer/constants';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';

export const PUSH_STALE_MS = 3500;

export interface AuthoritativeSnapshot {
  phase: LiveSessionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
  workStartedAtMs: number | null;
  segmentIndex: number;
  receivedAtMs: number;
}

export interface DisplayState {
  phase: LiveSessionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
  workStartedAtMs: number | null;
}

export interface SessionAuthoritativeInput {
  state: LiveSessionPhase;
  time_left_sec: number;
  is_paused: boolean;
  duration_minutes: number;
  started_at: string | null;
  segment_index: number;
}

export function createAuthoritativeSnapshot(
  input: SessionAuthoritativeInput,
  receivedAtMs: number
): AuthoritativeSnapshot {
  return {
    phase: input.state,
    timeLeftSec: input.time_left_sec,
    isPaused: input.is_paused,
    workDurationSec: input.duration_minutes * 60,
    workStartedAtMs: input.started_at ? Date.parse(input.started_at) : null,
    segmentIndex: input.segment_index,
    receivedAtMs,
  };
}

export function snapshotToDisplay(
  snapshot: AuthoritativeSnapshot,
  nowMs: number
): DisplayState {
  if (snapshot.phase !== 'setup' && snapshot.phase !== 'work') {
    return {
      phase: snapshot.phase,
      timeLeftSec: snapshot.timeLeftSec,
      isPaused: snapshot.isPaused,
      workDurationSec: snapshot.workDurationSec,
      workStartedAtMs: snapshot.workStartedAtMs,
    };
  }

  if (snapshot.isPaused) {
    return {
      phase: snapshot.phase,
      timeLeftSec: snapshot.timeLeftSec,
      isPaused: true,
      workDurationSec: snapshot.workDurationSec,
      workStartedAtMs: snapshot.workStartedAtMs,
    };
  }

  const elapsedSinceSyncMs = nowMs - snapshot.receivedAtMs;

  if (elapsedSinceSyncMs > PUSH_STALE_MS) {
    return {
      phase: snapshot.phase,
      timeLeftSec: snapshot.timeLeftSec,
      isPaused: false,
      workDurationSec: snapshot.workDurationSec,
      workStartedAtMs: snapshot.workStartedAtMs,
    };
  }

  const elapsedSinceSync = Math.floor(elapsedSinceSyncMs / 1000);

  let displayPhase: LiveSessionPhase = snapshot.phase;
  let displayTimeLeft = Math.max(0, snapshot.timeLeftSec - elapsedSinceSync);
  let workStartedAtMs = snapshot.workStartedAtMs;

  if (displayPhase === 'setup' && displayTimeLeft === 0) {
    displayPhase = 'work';
    displayTimeLeft = snapshot.workDurationSec;
    if (workStartedAtMs === null) {
      workStartedAtMs = nowMs;
    }
  }

  if (displayPhase === 'work' && displayTimeLeft === 0) {
    displayPhase = 'finished';
  }

  return {
    phase: displayPhase,
    timeLeftSec: displayTimeLeft,
    isPaused: false,
    workDurationSec: snapshot.workDurationSec,
    workStartedAtMs,
  };
}

export function applyAuthoritative(
  _snapshot: AuthoritativeSnapshot,
  input: SessionAuthoritativeInput,
  nowMs: number
): { snapshot: AuthoritativeSnapshot; display: DisplayState } {
  const updated = createAuthoritativeSnapshot(input, nowMs);
  return {
    snapshot: updated,
    display: snapshotToDisplay(updated, nowMs),
  };
}

export function selectElapsedSecFromDisplay(display: DisplayState): number {
  if (display.phase !== 'work' && display.phase !== 'finished') {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      display.workDurationSec,
      display.workDurationSec - display.timeLeftSec
    )
  );
}

export function getSetupDurationSec(): number {
  return DEFAULT_SETUP_DURATION_SEC;
}
