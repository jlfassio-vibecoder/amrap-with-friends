import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkHistory,
  type AttemptCandidate,
} from '@/lib/benchmark/benchmarkAttempts';

const BENCHMARK = { templateId: 'the-valve', durationMinutes: 10, versionKey: '' };
const KNEES_KEY = 'Diamond Push-ups#push-up--knees';
const KNEES = {
  modifiedMovements: ['Diamond Push-ups'],
  movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
};

function run(overrides: Partial<AttemptCandidate> & { missionId: string }): AttemptCandidate {
  return {
    templateId: 'the-valve',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    finalScore: 100,
    modifiedMovements: [],
    movementVariants: {},
    ...overrides,
  };
}

describe('buildBenchmarkHistory', () => {
  it('builds the series oldest first with the change across it', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 156 }),
      run({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 142 }),
    ]);

    expect(history.attempts.map((attempt) => attempt.score)).toEqual([142, 156]);
    expect(history.delta).toBe(14);
    expect(history.percentChange).toBe(9.9);
  });

  it('counts a run the athlete never pressed Retest for', () => {
    // What you scored on that workout at that clock is the measurement.
    const history = buildBenchmarkHistory(BENCHMARK, [run({ missionId: 'casual' })]);
    expect(history.attempts).toHaveLength(1);
  });

  it('keeps a differently-performed run out of the series but not out of sight', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({ missionId: 'std', finalScore: 142 }),
      run({ missionId: 'knees', createdAt: '2026-02-01T10:00:00Z', finalScore: 180, ...KNEES }),
    ]);

    expect(history.attempts.map((attempt) => attempt.missionId)).toEqual(['std']);
    expect(history.offVersionRuns.map((attempt) => attempt.missionId)).toEqual(['knees']);
    // The 180 never touches the trend, in either direction.
    expect(history.latest).toBe(142);
    expect(history.delta).toBeNull();
  });

  it('measures a modified benchmark against its own version', () => {
    const history = buildBenchmarkHistory(
      { ...BENCHMARK, versionKey: KNEES_KEY },
      [
        run({ missionId: 'k1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40, ...KNEES }),
        run({ missionId: 'k2', createdAt: '2026-02-01T10:00:00Z', finalScore: 48, ...KNEES }),
        run({ missionId: 'std', createdAt: '2026-03-01T10:00:00Z', finalScore: 30 }),
      ]
    );

    expect(history.attempts.map((attempt) => attempt.score)).toEqual([40, 48]);
    expect(history.offVersionRuns).toHaveLength(1);
    expect(history.percentChange).toBe(20);
  });

  it('ignores the same workout at a different clock', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [run({ missionId: 'm1', durationMinutes: 15 })]);
    expect(history.attempts).toEqual([]);
    expect(history.offVersionRuns).toEqual([]);
  });

  it('ignores a different workout at the same clock', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({ missionId: 'm1', templateId: 'equilibrium' }),
    ]);
    expect(history.attempts).toEqual([]);
  });

  it('ignores an unscored mission', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [run({ missionId: 'm1', finalScore: null })]);
    expect(history.attempts).toEqual([]);
  });

  it('has no delta from a single attempt', () => {
    // One point is a number, not a trend, and the card must not draw one.
    const history = buildBenchmarkHistory(BENCHMARK, [run({ missionId: 'm1', finalScore: 310 })]);
    expect(history.latest).toBe(310);
    expect(history.delta).toBeNull();
    expect(history.percentChange).toBeNull();
  });

  it('reports a decline as a decline', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 100 }),
      run({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 90 }),
    ]);
    expect(history.delta).toBe(-10);
    expect(history.percentChange).toBe(-10);
  });

  it('declines to report an infinite improvement from a zero opener', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 0 }),
      run({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 50 }),
    ]);
    expect(history.delta).toBe(50);
    expect(history.percentChange).toBeNull();
  });

  it('files an attempt under its scheduled time when it has one', () => {
    const history = buildBenchmarkHistory(BENCHMARK, [
      run({
        missionId: 'scheduled-first',
        createdAt: '2026-06-01T10:00:00Z',
        scheduledAt: '2026-01-01T10:00:00Z',
        finalScore: 100,
      }),
      run({ missionId: 'later', createdAt: '2026-02-01T10:00:00Z', finalScore: 120 }),
    ]);
    expect(history.attempts.map((attempt) => attempt.missionId)).toEqual([
      'scheduled-first',
      'later',
    ]);
  });

  it('is empty for a benchmark never run', () => {
    const history = buildBenchmarkHistory(BENCHMARK, []);
    expect(history).toMatchObject({ first: null, latest: null, delta: null, percentChange: null });
  });
});
