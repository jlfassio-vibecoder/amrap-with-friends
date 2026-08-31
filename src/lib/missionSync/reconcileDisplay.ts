import { DEFAULT_SETUP_DURATION_SEC } from '@/lib/amrapTimer/constants';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

export const PUSH_STALE_MS = 3500;

export interface AuthoritativeSnapshot {
  phase: LiveMissionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
  workStartedAtMs: number | null;
  segmentIndex: number;
  receivedAtMs: number;
  isFeatured: boolean;
  scheduledAtMs: number | null;
}

export interface DisplayState {
  phase: LiveMissionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  workDurationSec: number;
  workStartedAtMs: number | null;
}

export interface MissionAuthoritativeInput {
  state: LiveMissionPhase;
  time_left_sec: number;
  is_paused: boolean;
  duration_minutes: number;
  started_at: string | null;
  segment_index: number;
  is_featured?: boolean;
  scheduled_at?: string | null;
}

export function createAuthoritativeSnapshot(
  input: MissionAuthoritativeInput,
  receivedAtMs: number
): AuthoritativeSnapshot {
  const scheduledAtMs =
    input.scheduled_at != null && input.scheduled_at !== '' ? Date.parse(input.scheduled_at) : NaN;

  return {
    phase: input.state,
    timeLeftSec: input.time_left_sec,
    isPaused: input.is_paused,
    workDurationSec: input.duration_minutes * 60,
    workStartedAtMs: input.started_at ? Date.parse(input.started_at) : null,
    segmentIndex: input.segment_index,
    receivedAtMs,
    isFeatured: input.is_featured === true,
    scheduledAtMs: Number.isFinite(scheduledAtMs) ? scheduledAtMs : null,
  };
}

function wallClockWorkDisplay(
  snapshot: AuthoritativeSnapshot,
  nowMs: number,
  workStartedAtMs: number
): DisplayState {
  const elapsedWorkSec = Math.max(0, Math.floor((nowMs - workStartedAtMs) / 1000));
  const displayTimeLeft = Math.max(0, snapshot.workDurationSec - elapsedWorkSec);
  let displayPhase: LiveMissionPhase = 'work';
  if (displayTimeLeft === 0) {
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

export function snapshotToDisplay(snapshot: AuthoritativeSnapshot, nowMs: number): DisplayState {
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
  const isStale = elapsedSinceSyncMs > PUSH_STALE_MS;

  // Featured: after host Start, keep work moving from started_at when pushes
  // go stale. Do not invent setup/work from scheduled_at while still waiting.
  if (isStale && snapshot.isFeatured) {
    if (snapshot.phase === 'work' && snapshot.workStartedAtMs != null) {
      return wallClockWorkDisplay(snapshot, nowMs, snapshot.workStartedAtMs);
    }

    return {
      phase: snapshot.phase,
      timeLeftSec: snapshot.timeLeftSec,
      isPaused: false,
      workDurationSec: snapshot.workDurationSec,
      workStartedAtMs: snapshot.workStartedAtMs,
    };
  }

  if (isStale) {
    // Non-featured: freeze when host stops pushing (pause-safe; do not
    // re-derive from started_at which ignores paused wall time).
    return {
      phase: snapshot.phase,
      timeLeftSec: snapshot.timeLeftSec,
      isPaused: false,
      workDurationSec: snapshot.workDurationSec,
      workStartedAtMs: snapshot.workStartedAtMs,
    };
  }

  const elapsedSinceSync = Math.floor(elapsedSinceSyncMs / 1000);

  let displayPhase: LiveMissionPhase = snapshot.phase;
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
  input: MissionAuthoritativeInput,
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
    Math.min(display.workDurationSec, display.workDurationSec - display.timeLeftSec)
  );
}

export function getSetupDurationSec(): number {
  return DEFAULT_SETUP_DURATION_SEC;
}
