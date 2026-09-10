import { describe, expect, it } from 'vitest';
import { benchmarkReadinessNote } from '@/lib/benchmark/benchmarkReadiness';

describe('benchmarkReadinessNote', () => {
  it('warns that a test under high load reads as fatigue', () => {
    for (const level of ['elevated', 'high'] as const) {
      expect(benchmarkReadinessNote(level)).toMatch(/fatigue as much as fitness/);
    }
  });

  it('says nothing when the load is ordinary', () => {
    for (const level of ['normal', 'building'] as const) {
      expect(benchmarkReadinessNote(level)).toBeNull();
    }
  });

  it('never prescribes a rest day', () => {
    // An athlete who stops training drops the chronic baseline that caused the
    // warning, which makes next week's ratio worse. Settled in the
    // overtraining work; asserted here so a rewrite cannot quietly undo it.
    for (const level of ['normal', 'building', 'elevated', 'high'] as const) {
      const note = benchmarkReadinessNote(level) ?? '';
      expect(note).not.toMatch(/rest day|day off|take a day|skip/i);
    }
  });
});
