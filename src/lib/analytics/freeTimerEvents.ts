import { sendContentEvent } from '@/lib/analytics/contentBeacon';

/**
 * What the free timer on /amrap-timer reports.
 *
 * Someone running this is performing the product's core action without an
 * account, which makes it the highest-intent pre-signup behaviour on the site
 * — and until now it was indistinguishable from scrolling past. The vocabulary
 * deliberately mirrors the app's own missions (started / completed /
 * abandoned) so the free run and the real one can be compared without a
 * translation step.
 */

export interface FreeTimerRun {
  durationMinutes: number;
  rounds: number;
  timeLeftSec: number;
}

export function reportFreeTimerStarted(durationMinutes: number): void {
  sendContentEvent('free_timer_started', { duration_minutes: durationMinutes });
}

export function reportFreeTimerCompleted(run: FreeTimerRun): void {
  sendContentEvent('free_timer_completed', {
    duration_minutes: run.durationMinutes,
    round_count: run.rounds,
  });
}

/**
 * Only worth a beacon if they were mid-run. Leaving a timer that was never
 * started is just leaving the page, which content_page_viewed already covers.
 */
export function shouldReportFreeTimerAbandon(run: {
  started: boolean;
  finished: boolean;
}): boolean {
  return run.started && !run.finished;
}

export function reportFreeTimerAbandoned(run: FreeTimerRun): void {
  sendContentEvent('free_timer_abandoned', {
    duration_minutes: run.durationMinutes,
    round_count: run.rounds,
    time_left_sec: run.timeLeftSec,
  });
}

export function reportFreeTimerCtaClicked(placement: 'finished' | 'idle', run: FreeTimerRun): void {
  sendContentEvent('free_timer_cta_clicked', {
    placement,
    duration_minutes: run.durationMinutes,
    round_count: run.rounds,
  });
}
