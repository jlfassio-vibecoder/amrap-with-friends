import { describe, expect, it } from 'vitest';
import { campaignBenchmarkHistory } from '@/lib/benchmark/campaignBenchmarkHistory';
import type { BenchmarkSlot } from '@/lib/benchmark/benchmarkCap';
import type { AttemptCandidate } from '@/lib/benchmark/benchmarkAttempts';

const SLOT: BenchmarkSlot = {
  domain: 10,
  source: 'campaign',
  templateId: 'the-hemodynamic',
  durationMinutes: 10,
  campaignName: '8-week Blood Shunt',
};

const KNEES = {
  modifiedMovements: ['Diamond Push-ups'],
  movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
};

function run(overrides: Partial<AttemptCandidate> & { missionId: string }): AttemptCandidate {
  return {
    templateId: 'the-hemodynamic',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    finalScore: 100,
    modifiedMovements: [],
    movementVariants: {},
    ...overrides,
  };
}

describe('campaignBenchmarkHistory', () => {
  it('reads week one against the retest', () => {
    const history = campaignBenchmarkHistory(SLOT, [
      run({ missionId: 'w1', createdAt: '2026-01-01T10:00:00Z', finalScore: 142 }),
      run({ missionId: 'w8', createdAt: '2026-03-01T10:00:00Z', finalScore: 168 }),
    ]);

    expect(history?.attempts.map((attempt) => attempt.score)).toEqual([142, 168]);
    expect(history?.delta).toBe(26);
  });

  it('is null before the athlete has run it', () => {
    expect(campaignBenchmarkHistory(SLOT, [])).toBeNull();
    expect(campaignBenchmarkHistory(SLOT, [run({ missionId: 'x', finalScore: null })])).toBeNull();
  });

  it('takes its version from the first attempt, not the most recent', () => {
    // Modified in week one, standard at the retest: the standard run is the
    // change, not a new baseline. Taking the latest version would redefine the
    // test and make the athlete's actual progress vanish from the series.
    const history = campaignBenchmarkHistory(SLOT, [
      run({ missionId: 'w1', createdAt: '2026-01-01T10:00:00Z', finalScore: 120, ...KNEES }),
      run({ missionId: 'w8', createdAt: '2026-03-01T10:00:00Z', finalScore: 108 }),
    ]);

    expect(history?.attempts.map((attempt) => attempt.missionId)).toEqual(['w1']);
    expect(history?.offVersionRuns.map((attempt) => attempt.missionId)).toEqual(['w8']);
  });

  it('measures a consistently modified campaign against its own version', () => {
    const history = campaignBenchmarkHistory(SLOT, [
      run({ missionId: 'w1', createdAt: '2026-01-01T10:00:00Z', finalScore: 120, ...KNEES }),
      run({ missionId: 'w8', createdAt: '2026-03-01T10:00:00Z', finalScore: 140, ...KNEES }),
    ]);

    expect(history?.delta).toBe(20);
    expect(history?.offVersionRuns).toEqual([]);
  });

  it('uses the benchmark’s real clock, not its domain', () => {
    // A campaign testing at 12 minutes sits in the 15-minute domain. Matching
    // on the domain would pull in every 15-minute run of the same workout.
    const twelve: BenchmarkSlot = { ...SLOT, domain: 15, durationMinutes: 12 };
    const history = campaignBenchmarkHistory(twelve, [
      run({ missionId: 'right', durationMinutes: 12, finalScore: 90 }),
      run({ missionId: 'wrong', durationMinutes: 15, finalScore: 130 }),
    ]);

    expect(history?.attempts.map((attempt) => attempt.missionId)).toEqual(['right']);
  });

  it('derives the version from a run at the right clock, not merely the right domain', () => {
    // 12 and 15 minutes share the 15-minute domain. If the search for the first
    // attempt matched on the domain, the earlier 15-minute run would define the
    // version, and the 12-minute series would then measure the wrong thing.
    const twelve: BenchmarkSlot = { ...SLOT, domain: 15, durationMinutes: 12 };
    const history = campaignBenchmarkHistory(twelve, [
      run({
        missionId: 'earlier-15',
        durationMinutes: 15,
        createdAt: '2026-01-01T10:00:00Z',
        finalScore: 130,
        ...KNEES,
      }),
      run({
        missionId: 'first-12',
        durationMinutes: 12,
        createdAt: '2026-02-01T10:00:00Z',
        finalScore: 90,
      }),
      run({
        missionId: 'second-12',
        durationMinutes: 12,
        createdAt: '2026-03-01T10:00:00Z',
        finalScore: 96,
      }),
    ]);

    expect(history?.attempts.map((attempt) => attempt.missionId)).toEqual([
      'first-12',
      'second-12',
    ]);
    expect(history?.offVersionRuns).toEqual([]);
  });

  it('ignores a different workout at the same clock', () => {
    expect(
      campaignBenchmarkHistory(SLOT, [run({ missionId: 'x', templateId: 'the-valve' })])
    ).toBeNull();
  });

  it('files an attempt under its scheduled time when picking the first', () => {
    const history = campaignBenchmarkHistory(SLOT, [
      run({
        missionId: 'scheduled-first',
        createdAt: '2026-06-01T10:00:00Z',
        scheduledAt: '2026-01-01T10:00:00Z',
        finalScore: 120,
        ...KNEES,
      }),
      run({ missionId: 'later', createdAt: '2026-02-01T10:00:00Z', finalScore: 130 }),
    ]);

    // The version comes from the mission that happened first, not the row that
    // was written first.
    expect(history?.attempts.map((attempt) => attempt.missionId)).toEqual(['scheduled-first']);
  });
});
