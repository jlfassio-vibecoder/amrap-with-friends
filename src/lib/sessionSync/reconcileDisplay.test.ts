import { describe, it, expect } from 'vitest';
import {
  applyAuthoritative,
  createAuthoritativeSnapshot,
  PUSH_STALE_MS,
  snapshotToDisplay,
  type AuthoritativeSnapshot,
} from './reconcileDisplay';

const BASE_MS = 1_700_000_000_000;

function makeInput(
  overrides: Partial<{
    state: 'waiting' | 'setup' | 'work' | 'finished';
    time_left_sec: number;
    is_paused: boolean;
    duration_minutes: number;
    started_at: string | null;
    segment_index: number;
  }> = {}
) {
  return {
    state: overrides.state ?? 'waiting',
    time_left_sec: overrides.time_left_sec ?? 10,
    is_paused: overrides.is_paused ?? false,
    duration_minutes: overrides.duration_minutes ?? 15,
    started_at: overrides.started_at ?? null,
    segment_index: overrides.segment_index ?? 0,
  };
}

describe('reconcileDisplay', () => {
  it('mirrors waiting phase without local tick', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'waiting', time_left_sec: 10 }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 2000);
    expect(display.phase).toBe('waiting');
    expect(display.timeLeftSec).toBe(10);
  });

  it('interpolates countdown between pushes during work', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({
        state: 'work',
        time_left_sec: 900,
        started_at: '2026-08-22T12:00:00.000Z',
      }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 2000);
    expect(display.phase).toBe('work');
    expect(display.timeLeftSec).toBe(898);
  });

  it('freezes display when paused', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({
        state: 'work',
        time_left_sec: 500,
        is_paused: true,
      }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 5000);
    expect(display.isPaused).toBe(true);
    expect(display.timeLeftSec).toBe(500);
  });

  it('freezes display after stale threshold when host stops pushing', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'work', time_left_sec: 400 }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + PUSH_STALE_MS + 1000);
    expect(display.timeLeftSec).toBe(400);
    expect(display.phase).toBe('work');
  });

  it('transitions setup to work locally when countdown hits zero', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'setup', time_left_sec: 2 }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 2000);
    expect(display.phase).toBe('work');
    expect(display.timeLeftSec).toBe(900);
    expect(display.workStartedAtMs).toBe(BASE_MS + 2000);
  });

  it('uses authoritative started_at when setup transitions locally', () => {
    const startedAt = '2026-08-22T12:00:00.000Z';
    const snapshot = createAuthoritativeSnapshot(
      makeInput({
        state: 'setup',
        time_left_sec: 1,
        started_at: startedAt,
      }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 1000);
    expect(display.phase).toBe('work');
    expect(display.workStartedAtMs).toBe(Date.parse(startedAt));
  });

  it('transitions work to finished when local countdown hits zero', () => {
    const snapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'work', time_left_sec: 1 }),
      BASE_MS
    );
    const display = snapshotToDisplay(snapshot, BASE_MS + 1000);
    expect(display.phase).toBe('finished');
    expect(display.timeLeftSec).toBe(0);
  });

  it('applyAuthoritative updates snapshot and display on incoming push', () => {
    const initial: AuthoritativeSnapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'waiting' }),
      BASE_MS
    );
    const { snapshot, display } = applyAuthoritative(
      initial,
      makeInput({ state: 'setup', time_left_sec: 10 }),
      BASE_MS + 500
    );
    expect(snapshot.phase).toBe('setup');
    expect(display.phase).toBe('setup');
    expect(display.timeLeftSec).toBe(10);
  });

  it('reconciles sequence of pushes with local ticks', () => {
    let snapshot = createAuthoritativeSnapshot(
      makeInput({ state: 'setup', time_left_sec: 10 }),
      BASE_MS
    );
    let display = snapshotToDisplay(snapshot, BASE_MS);
    expect(display.timeLeftSec).toBe(10);

    display = snapshotToDisplay(snapshot, BASE_MS + 3000);
    expect(display.timeLeftSec).toBe(7);

    const pushed = applyAuthoritative(
      snapshot,
      makeInput({ state: 'work', time_left_sec: 897, started_at: '2026-08-22T12:00:00.000Z' }),
      BASE_MS + 3000
    );
    snapshot = pushed.snapshot;
    display = snapshotToDisplay(snapshot, BASE_MS + 5000);
    expect(display.phase).toBe('work');
    expect(display.timeLeftSec).toBe(895);
  });
});
