import type { OvertrainingRiskLevel } from '@/lib/hud/evaluateOvertrainingRisk';

/**
 * Whether today is a fair day to test.
 *
 * A campaign puts an easy day before a test so the test measures fitness rather
 * than fatigue. A personal benchmark cannot schedule that — but the signal
 * already exists, so the card can say what the athlete's own load is doing and
 * let them choose.
 *
 * **It is a sentence, never a gate.** It does not hide the Retest link, it does
 * not delay the due date, and it never prescribes a rest day. That last part is
 * settled: an athlete who stops training drops the chronic baseline that caused
 * the warning, which makes next week's ratio worse — so the guidance keeps
 * people active or it says nothing at all. Here it says nothing beyond the
 * caveat, because the honest advice is "your number will read low today", and
 * what to do about that is the athlete's call.
 */
export function benchmarkReadinessNote(riskLevel: OvertrainingRiskLevel): string | null {
  if (riskLevel === 'elevated' || riskLevel === 'high') {
    return 'Your load is high this week. A test today measures fatigue as much as fitness.';
  }
  return null;
}
