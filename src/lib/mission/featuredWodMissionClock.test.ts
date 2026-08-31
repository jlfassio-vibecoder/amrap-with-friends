import { describe, expect, it } from 'vitest';
import {
  computeFeaturedMissionClock,
  FEATURED_SETUP_DURATION_SEC,
} from './featuredWodMissionClock';

const SCHEDULED_MS = Date.parse('2026-08-29T16:00:00.000Z');
const SETUP_MS = FEATURED_SETUP_DURATION_SEC * 1000;
const WORK_MS = 15 * 60 * 1000;

describe('computeFeaturedMissionClock', () => {
  it('stays waiting before scheduled_at', () => {
    const clock = computeFeaturedMissionClock({
      scheduledAtMs: SCHEDULED_MS,
      durationMinutes: 15,
      nowMs: SCHEDULED_MS - 1000,
    });
    expect(clock.phase).toBe('waiting');
    expect(clock.workStartedAtMs).toBeNull();
    expect(clock.timeLeftSec).toBe(FEATURED_SETUP_DURATION_SEC);
  });

  it('runs setup without consuming work duration', () => {
    const clock = computeFeaturedMissionClock({
      scheduledAtMs: SCHEDULED_MS,
      durationMinutes: 15,
      nowMs: SCHEDULED_MS + 3000,
    });
    expect(clock.phase).toBe('setup');
    expect(clock.timeLeftSec).toBe(7);
    expect(clock.workStartedAtMs).toBeNull();
  });

  it('starts work at scheduled_at + setup with full remaining', () => {
    const workStart = SCHEDULED_MS + SETUP_MS;
    const clock = computeFeaturedMissionClock({
      scheduledAtMs: SCHEDULED_MS,
      durationMinutes: 15,
      nowMs: workStart,
    });
    expect(clock.phase).toBe('work');
    expect(clock.timeLeftSec).toBe(900);
    expect(clock.workStartedAtMs).toBe(workStart);
  });

  it('derives work remaining from wall clock after setup', () => {
    const workStart = SCHEDULED_MS + SETUP_MS;
    const clock = computeFeaturedMissionClock({
      scheduledAtMs: SCHEDULED_MS,
      durationMinutes: 15,
      nowMs: workStart + 50_000,
    });
    expect(clock.phase).toBe('work');
    expect(clock.timeLeftSec).toBe(850);
    expect(clock.workStartedAtMs).toBe(workStart);
  });

  it('finishes after setup + duration', () => {
    const clock = computeFeaturedMissionClock({
      scheduledAtMs: SCHEDULED_MS,
      durationMinutes: 15,
      nowMs: SCHEDULED_MS + SETUP_MS + WORK_MS,
    });
    expect(clock.phase).toBe('finished');
    expect(clock.timeLeftSec).toBe(0);
  });
});
