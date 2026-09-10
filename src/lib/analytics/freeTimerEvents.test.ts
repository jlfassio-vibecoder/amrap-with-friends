import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendContentEvent = vi.fn();
vi.mock('@/lib/analytics/contentBeacon', () => ({ sendContentEvent }));

const {
  reportFreeTimerAbandoned,
  reportFreeTimerCompleted,
  reportFreeTimerCtaClicked,
  reportFreeTimerStarted,
  shouldReportFreeTimerAbandon,
} = await import('@/lib/analytics/freeTimerEvents');

const run = { durationMinutes: 20, rounds: 7, timeLeftSec: 240 };

describe('shouldReportFreeTimerAbandon', () => {
  it('reports only a run that started and did not finish', () => {
    expect(shouldReportFreeTimerAbandon({ started: true, finished: false })).toBe(true);
  });

  it('ignores a timer that was never started', () => {
    // Leaving an untouched timer is just leaving the page.
    expect(shouldReportFreeTimerAbandon({ started: false, finished: false })).toBe(false);
  });

  it('does not call a completed run abandoned', () => {
    expect(shouldReportFreeTimerAbandon({ started: true, finished: true })).toBe(false);
  });
});

describe('free timer reporting', () => {
  beforeEach(() => {
    sendContentEvent.mockReset();
  });

  it('reports the start with the chosen domain', () => {
    reportFreeTimerStarted(10);
    expect(sendContentEvent).toHaveBeenCalledWith('free_timer_started', {
      duration_minutes: 10,
    });
  });

  it('reports a completion with the work done', () => {
    reportFreeTimerCompleted(run);
    expect(sendContentEvent).toHaveBeenCalledWith('free_timer_completed', {
      duration_minutes: 20,
      round_count: 7,
    });
  });

  it('reports an abandon with where on the clock they left', () => {
    // The same shape the app's mission_abandoned carries, so free runs and
    // real ones can be compared without translating.
    reportFreeTimerAbandoned(run);
    expect(sendContentEvent).toHaveBeenCalledWith('free_timer_abandoned', {
      duration_minutes: 20,
      round_count: 7,
      time_left_sec: 240,
    });
  });

  it('distinguishes the CTA after a finished run from the idle one', () => {
    reportFreeTimerCtaClicked('finished', run);
    expect(sendContentEvent).toHaveBeenCalledWith('free_timer_cta_clicked', {
      placement: 'finished',
      duration_minutes: 20,
      round_count: 7,
    });
  });
});
