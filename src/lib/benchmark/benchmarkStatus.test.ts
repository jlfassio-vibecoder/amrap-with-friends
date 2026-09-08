import { describe, expect, it } from 'vitest';
import {
  RETEST_MIN_DAYS,
  RETEST_MIN_MISSIONS,
  benchmarkStatus,
  formatBenchmarkStatus,
  missionsSince,
} from '@/lib/benchmark/benchmarkStatus';

const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe('benchmarkStatus', () => {
  it('asks for a baseline before it can ask for anything else', () => {
    expect(benchmarkStatus({ lastAttemptAt: null, missionsSince: 40, now: NOW })).toEqual({
      state: 'no-baseline',
    });
  });

  it('is due once both gates are met', () => {
    expect(
      benchmarkStatus({ lastAttemptAt: daysAgo(30), missionsSince: 12, now: NOW })
    ).toEqual({ state: 'due' });
  });

  it('holds on time even after a heavy block of training', () => {
    // Nine days and fifteen missions is not adaptation, it is a heavy week.
    const status = benchmarkStatus({ lastAttemptAt: daysAgo(9), missionsSince: 15, now: NOW });
    expect(status).toMatchObject({ state: 'waiting', binding: 'days', daysRemaining: 19 });
  });

  it('holds on missions after a month of barely training', () => {
    // Twenty-eight days in which you trained twice is not twenty-eight days of
    // training, so the count is what is left to satisfy.
    const status = benchmarkStatus({ lastAttemptAt: daysAgo(40), missionsSince: 2, now: NOW });
    expect(status).toMatchObject({
      state: 'waiting',
      binding: 'missions',
      missionsRemaining: RETEST_MIN_MISSIONS - 2,
      daysRemaining: 0,
    });
  });

  it('reports the day gate while both are outstanding', () => {
    // Both are unmet, and the later one is what the athlete is really waiting
    // on — telling them to train more would be wrong when time is the blocker.
    expect(
      benchmarkStatus({ lastAttemptAt: daysAgo(3), missionsSince: 1, now: NOW })
    ).toMatchObject({ binding: 'days' });
  });

  it('is not due one day early', () => {
    expect(
      benchmarkStatus({
        lastAttemptAt: daysAgo(RETEST_MIN_DAYS - 1),
        missionsSince: 20,
        now: NOW,
      })
    ).toMatchObject({ state: 'waiting', daysRemaining: 1 });
  });

  it('is due exactly on the boundary', () => {
    expect(
      benchmarkStatus({
        lastAttemptAt: daysAgo(RETEST_MIN_DAYS),
        missionsSince: RETEST_MIN_MISSIONS,
        now: NOW,
      })
    ).toEqual({ state: 'due' });
  });

  it('never asks for a negative wait', () => {
    const status = benchmarkStatus({ lastAttemptAt: daysAgo(90), missionsSince: 3, now: NOW });
    expect(status).toMatchObject({ daysRemaining: 0, missionsRemaining: 5 });
  });

  it('treats an unparseable timestamp as no baseline rather than as due', () => {
    expect(benchmarkStatus({ lastAttemptAt: 'not a date', missionsSince: 99, now: NOW })).toEqual({
      state: 'no-baseline',
    });
  });

  it('produces the shapes the athlete actually reads', () => {
    expect(formatBenchmarkStatus({ state: 'due' })).toBe('Retest due');
    expect(formatBenchmarkStatus({ state: 'no-baseline' })).toMatch(/baseline/);
    expect(
      formatBenchmarkStatus({
        state: 'waiting',
        binding: 'days',
        daysRemaining: 11,
        missionsRemaining: 0,
      })
    ).toBe('Retest in 11 days');
    expect(
      formatBenchmarkStatus({
        state: 'waiting',
        binding: 'missions',
        daysRemaining: 0,
        missionsRemaining: 5,
      })
    ).toBe('Retest in 5 missions');
  });

  it('says "1 day" and "1 mission", not "1 days"', () => {
    expect(
      formatBenchmarkStatus({
        state: 'waiting',
        binding: 'days',
        daysRemaining: 1,
        missionsRemaining: 0,
      })
    ).toBe('Retest in 1 day');
    expect(
      formatBenchmarkStatus({
        state: 'waiting',
        binding: 'missions',
        daysRemaining: 0,
        missionsRemaining: 1,
      })
    ).toBe('Retest in 1 mission');
  });
});

describe('missionsSince', () => {
  const missions = [
    { at: daysAgo(40), scored: true },
    { at: daysAgo(20), scored: true },
    { at: daysAgo(10), scored: true },
    { at: daysAgo(5), scored: false },
  ];

  it('counts only what came after the attempt', () => {
    expect(missionsSince(daysAgo(30), missions)).toBe(2);
  });

  it('does not count an unscored mission', () => {
    // An abandoned mission is not training that happened.
    expect(missionsSince(daysAgo(45), missions)).toBe(3);
  });

  it('counts nothing when there is no baseline to count from', () => {
    expect(missionsSince(null, missions)).toBe(0);
  });

  it('counts any mission, not only ones in the benchmark’s domain', () => {
    // General training drives the adaptation; counting same-domain missions
    // only would push athletes toward training the test.
    expect(missionsSince(daysAgo(50), missions)).toBe(3);
  });
});
