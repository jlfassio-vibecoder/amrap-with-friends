import { describe, expect, it } from 'vitest';
import { benchmarkForMission } from '@/lib/benchmark/matchBenchmark';
import type { AthleteBenchmark } from '@/lib/api/benchmarks';

const base: AthleteBenchmark = {
  id: 'b1',
  templateId: 'the-valve',
  durationMinutes: 10,
  timeDomain: 10,
  versionKey: '',
  movementVariants: {},
  designatedAt: '2026-01-01T10:00:00.000Z',
  retiredAt: null,
};

describe('benchmarkForMission', () => {
  it('matches a mission on the workout and the clock', () => {
    expect(benchmarkForMission({ templateId: 'the-valve', durationMinutes: 10 }, [base])?.id).toBe(
      'b1'
    );
  });

  it('badges a run from before the benchmark was designated', () => {
    // A benchmark is a workout you come back to, so every run of it counts —
    // the same call the attempt derivation makes.
    const mission = { templateId: 'the-valve', durationMinutes: 10 };
    expect(
      benchmarkForMission(mission, [{ ...base, designatedAt: '2026-06-01T10:00:00Z' }])
    ).not.toBeNull();
  });

  it('does not match the same workout at a different clock', () => {
    expect(
      benchmarkForMission({ templateId: 'the-valve', durationMinutes: 15 }, [base])
    ).toBeNull();
  });

  it('does not match a different workout at the same clock', () => {
    expect(
      benchmarkForMission({ templateId: 'equilibrium', durationMinutes: 10 }, [base])
    ).toBeNull();
  });

  it('ignores an ad-hoc mission with no template', () => {
    expect(benchmarkForMission({ templateId: null, durationMinutes: 10 }, [base])).toBeNull();
  });

  it('still badges a mission whose benchmark has been retired', () => {
    const retired = { ...base, retiredAt: '2026-03-01T10:00:00.000Z' };
    expect(
      benchmarkForMission({ templateId: 'the-valve', durationMinutes: 10 }, [retired])?.id
    ).toBe('b1');
  });

  it('prefers the live benchmark over a retired one on the same workout', () => {
    const retired = { ...base, id: 'old', retiredAt: '2026-03-01T10:00:00.000Z' };
    const live = { ...base, id: 'new' };
    expect(
      benchmarkForMission({ templateId: 'the-valve', durationMinutes: 10 }, [retired, live])?.id
    ).toBe('new');
  });

  it('is null for an athlete with no benchmarks', () => {
    expect(benchmarkForMission({ templateId: 'the-valve', durationMinutes: 10 }, [])).toBeNull();
  });
});
