import { describe, expect, it } from 'vitest';
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from '@/data/workoutTemplates';
import { filterWorkoutTemplates } from '@/lib/workout/filterWorkoutTemplates';
import { benchmarkTemplateIdFor } from './campaignBenchmarks';
import { orderPoolByVolume, repsPerRound } from './campaignVolume';
import { planCampaignWorkouts } from './planCampaignWorkouts';
import { CampaignValidationError, type CampaignOccurrence, type CampaignTrack } from './types';

function template(
  id: string,
  durationMinutes: 5 | 10,
  category: 'blood-shunt' | 'engine-room',
  reps: number
): WorkoutTemplate {
  return {
    id,
    name: id.toUpperCase(),
    durationMinutes,
    category,
    intensityTier: 3,
    movements: [{ name: 'Burpees', reps }],
    tacticalNote: 'note',
  };
}

// 'flash-flood' is the real benchmark for the 5-minute Blood Shunt track, so
// the fixture exercises the same lookup production does. It sits mid-pool by
// volume, which is the point: a benchmark should be neither the easiest nor
// the hardest mission in its track.
const BLOOD_SHUNT: WorkoutTemplate[] = [
  template('bs-heavy', 5, 'blood-shunt', 60),
  template('bs-light', 5, 'blood-shunt', 10),
  template('flash-flood', 5, 'blood-shunt', 30),
  template('bs-mid', 5, 'blood-shunt', 40),
];

// 'constant-current' is the real 10-minute Engine Room benchmark, so the
// fixture can lead with either track.
const ENGINE_ROOM: WorkoutTemplate[] = [
  template('er-heavy', 10, 'engine-room', 70),
  template('er-light', 10, 'engine-room', 20),
  template('constant-current', 10, 'engine-room', 50),
];

const TEMPLATES = [...BLOOD_SHUNT, ...ENGINE_ROOM];

const BLOOD_SHUNT_TRACK = { durationMinutes: 5, category: 'blood-shunt' } as const;
const ENGINE_ROOM_TRACK = { durationMinutes: 10, category: 'engine-room' } as const;

function occurrences(weekCount: number, perWeek: number): CampaignOccurrence[] {
  const rows: CampaignOccurrence[] = [];
  for (let week = 1; week <= weekCount; week += 1) {
    for (let slot = 1; slot <= perWeek; slot += 1) {
      rows.push({
        sequence: rows.length + 1,
        weekNumber: week,
        slotNumber: slot,
        localDate: '2026-03-02',
        localTime: '18:00',
        weekday: 1,
      });
    }
  }
  return rows;
}

function plan(
  weekCount: number,
  perWeek: number,
  tracks: readonly CampaignTrack[] = [BLOOD_SHUNT_TRACK]
) {
  return planCampaignWorkouts({
    occurrences: occurrences(weekCount, perWeek),
    tracks: [...tracks],
    templates: TEMPLATES,
  });
}

describe('planCampaignWorkouts', () => {
  it('gives every occurrence a workout', () => {
    const planned = plan(8, 3);
    expect(planned).toHaveLength(24);
    expect(planned.every((entry) => entry.templateId.length > 0)).toBe(true);
    expect(planned.every((entry) => entry.workout.length > 0)).toBe(true);
  });

  it('preserves the calendar fields it was given', () => {
    const [first] = plan(2, 1);
    expect(first.sequence).toBe(1);
    expect(first.weekNumber).toBe(1);
    expect(first.slotNumber).toBe(1);
    expect(first.localDate).toBe('2026-03-02');
    expect(first.localTime).toBe('18:00');
  });

  it('opens with the benchmark for the leading track', () => {
    const planned = plan(8, 3);
    expect(planned[0].templateId).toBe('flash-flood');
  });

  it('closes by repeating the benchmark, so the campaign has a result', () => {
    const planned = plan(8, 3);
    expect(planned[planned.length - 1].templateId).toBe('flash-flood');
  });

  it('runs the benchmark only on test days', () => {
    // 8 weeks tests in weeks 1, 4 and 8.
    const planned = plan(8, 3);
    const testIndices = planned
      .map((entry, index) => (entry.templateId === 'flash-flood' ? index : -1))
      .filter((index) => index >= 0);
    expect(testIndices).toEqual([0, 11, 23]);
  });

  it('retests at the end of a week, not the middle of it', () => {
    const planned = plan(8, 3);
    const midRetest = planned[11];
    expect(midRetest.weekNumber).toBe(4);
    expect(midRetest.slotNumber).toBe(3);
  });

  it('tests twice in a short campaign and three times in a long one', () => {
    const count = (weekCount: number) =>
      plan(weekCount, 2).filter((entry) => entry.templateId === 'flash-flood').length;
    expect(count(2)).toBe(2);
    expect(count(4)).toBe(2);
    expect(count(6)).toBe(3);
    expect(count(8)).toBe(3);
    expect(count(12)).toBe(3);
  });

  it('keeps the benchmark out of the build rotation', () => {
    // Four templates in the pool; without the exclusion a 12-week campaign
    // would meet the benchmark on ordinary days too.
    const planned = plan(12, 2);
    const tests = planned.filter((entry) => entry.templateId === 'flash-flood');
    expect(tests).toHaveLength(3);
  });

  it('walks the build missions lightest to heaviest', () => {
    const planned = plan(4, 2);
    // Weeks 1-4, 2 a week: index 0 is the benchmark, index 7 the retest.
    const builds = planned.slice(1, 7).map((entry) => entry.templateId);
    expect(builds).toEqual(['bs-light', 'bs-mid', 'bs-heavy', 'bs-light', 'bs-mid', 'bs-heavy']);
  });

  it('backs off before each retest in a long campaign', () => {
    const planned = plan(8, 3);
    // Retests sit at 11 and 23, so 10 and 22 are the easy days.
    expect(planned[10].templateId).toBe('bs-light');
    expect(planned[22].templateId).toBe('bs-mid');
  });

  it('does not run the same workout twice to get to an easy day', () => {
    // The build rotation can wrap back to its own lightest right before a
    // deload, which is where the repeat used to come from.
    const planned = plan(8, 3);
    planned.forEach((entry, index) => {
      if (index > 0) {
        expect(entry.templateId, `mission ${index + 1}`).not.toBe(planned[index - 1].templateId);
      }
    });
  });

  it('never uses the benchmark as an easy day', () => {
    // A deload running the test workout would read as a third test.
    const benchmarkIsLightest: WorkoutTemplate[] = [
      template('flash-flood', 5, 'blood-shunt', 5),
      template('bs-a', 5, 'blood-shunt', 20),
      template('bs-b', 5, 'blood-shunt', 30),
    ];
    const planned = planCampaignWorkouts({
      occurrences: occurrences(8, 3),
      tracks: [BLOOD_SHUNT_TRACK],
      templates: benchmarkIsLightest,
    });
    expect(planned[10].templateId).not.toBe('flash-flood');
    expect(planned[22].templateId).not.toBe('flash-flood');
    expect(planned.filter((entry) => entry.templateId === 'flash-flood')).toHaveLength(3);
  });

  it('never spends a mission going easy in a short campaign', () => {
    // A 4-week campaign trains 8 times; giving up two of those to deloads
    // costs more than the cleaner test is worth.
    const planned = plan(4, 2);
    expect(planned[6].templateId).not.toBe('bs-light');
  });

  it('picks the lightest workout across every track for the easy day', () => {
    const planned = plan(8, 2, [BLOOD_SHUNT_TRACK, ENGINE_ROOM_TRACK]);
    const easy = planned[planned.length - 2];
    expect(easy.templateId).toBe('bs-light');
    expect(repsPerRound(BLOOD_SHUNT[1])).toBeLessThan(repsPerRound(ENGINE_ROOM[1]));
  });

  it('labels an easy day with the workout it actually runs, not the track slot', () => {
    // The deload can come from a different track than the mission it replaces,
    // so the category has to follow the template.
    const planned = plan(8, 2, [ENGINE_ROOM_TRACK, BLOOD_SHUNT_TRACK]);
    const easy = planned[planned.length - 2];
    expect(easy.templateId).toBe('bs-light');
    expect(easy.category).toBe('blood-shunt');
    expect(easy.durationMinutes).toBe(5);
  });

  it('rotates build missions across the tracks the host picked', () => {
    const planned = plan(6, 2, [BLOOD_SHUNT_TRACK, ENGINE_ROOM_TRACK]);
    const builds = planned.slice(1, 5);
    expect(builds.map((entry) => entry.durationMinutes)).toEqual([5, 10, 5, 10]);
  });

  it('is deterministic, so the host gets the plan they previewed', () => {
    expect(plan(8, 3)).toEqual(plan(8, 3));
  });

  it('falls back to a plain build when the leading track has no benchmark', () => {
    const orphan = [template('orphan-1', 5, 'engine-room', 10)];
    const planned = planCampaignWorkouts({
      occurrences: occurrences(2, 2),
      tracks: [{ durationMinutes: 5, category: 'engine-room' }],
      templates: orphan,
    });
    expect(benchmarkTemplateIdFor({ durationMinutes: 5, category: 'engine-room' })).toBe(
      'the-gas-pedal'
    );
    expect(planned.every((entry) => entry.templateId === 'orphan-1')).toBe(true);
  });

  it('returns nothing for an empty calendar', () => {
    expect(planCampaignWorkouts({ occurrences: [], tracks: [BLOOD_SHUNT_TRACK] })).toEqual([]);
  });

  it('refuses a campaign with no tracks', () => {
    expect(() => planCampaignWorkouts({ occurrences: occurrences(2, 1), tracks: [] })).toThrow(
      CampaignValidationError
    );
  });

  it('refuses a track the library cannot fill', () => {
    expect(() =>
      planCampaignWorkouts({
        occurrences: occurrences(2, 1),
        tracks: [{ durationMinutes: 20, category: 'armor-protocol' }],
        templates: TEMPLATES,
      })
    ).toThrow(CampaignValidationError);
  });

  describe('against the shipped library', () => {
    it('opens and closes a default campaign on the same workout', () => {
      const planned = planCampaignWorkouts({
        occurrences: occurrences(8, 3),
        tracks: [
          { durationMinutes: 10, category: 'blood-shunt' },
          { durationMinutes: 15, category: 'engine-room' },
        ],
      });
      expect(planned[0].templateId).toBe('the-hemodynamic');
      expect(planned[planned.length - 1].templateId).toBe('the-hemodynamic');
    });

    it('does not repeat a build workout while unseen ones remain', () => {
      const planned = planCampaignWorkouts({
        occurrences: occurrences(4, 2),
        tracks: [
          { durationMinutes: 10, category: 'blood-shunt' },
          { durationMinutes: 15, category: 'engine-room' },
        ],
      });
      const builds = planned.slice(1, planned.length - 1).map((entry) => entry.templateId);
      expect(new Set(builds).size).toBe(builds.length);
    });

    it('walks a whole track pool uphill before repeating anything', () => {
      const planned = planCampaignWorkouts({
        occurrences: occurrences(8, 3),
        tracks: [{ durationMinutes: 10, category: 'blood-shunt' }],
      });
      const byId = new Map(WORKOUT_TEMPLATES.map((entry) => [entry.id, entry]));
      const buildPool = orderPoolByVolume(
        filterWorkoutTemplates(WORKOUT_TEMPLATES, {
          durationMinutes: 10,
          category: 'blood-shunt',
        }).filter((entry) => entry.id !== 'the-hemodynamic')
      );

      // Mission 1 is the benchmark; the first pass through the build pool
      // follows it, one mission per template.
      const firstPass = planned.slice(1, 1 + buildPool.length);
      expect(firstPass.map((entry) => entry.templateId)).toEqual(
        buildPool.map((entry) => entry.id)
      );

      const volumes = firstPass.map((entry) => repsPerRound(byId.get(entry.templateId)!));
      expect(volumes).toEqual([...volumes].sort((a, b) => a - b));
      expect(volumes[volumes.length - 1]).toBeGreaterThan(volumes[0]);
    });
  });

  it('uses tracks[0] as the measurement track — reordering changes the tests only', () => {
    const calendar = occurrences(4, 2);
    const bloodFirst = planCampaignWorkouts({
      occurrences: calendar,
      tracks: [BLOOD_SHUNT_TRACK, ENGINE_ROOM_TRACK],
      templates: TEMPLATES,
    });
    const engineFirst = planCampaignWorkouts({
      occurrences: calendar,
      tracks: [ENGINE_ROOM_TRACK, BLOOD_SHUNT_TRACK],
      templates: TEMPLATES,
    });

    expect(bloodFirst[0].templateId).toBe('flash-flood');
    expect(bloodFirst[bloodFirst.length - 1].templateId).toBe('flash-flood');
    expect(engineFirst[0].templateId).toBe('constant-current');
    expect(engineFirst[engineFirst.length - 1].templateId).toBe('constant-current');

    const bloodBuilds = bloodFirst.slice(1, -1).map((entry) => entry.templateId);
    const engineBuilds = engineFirst.slice(1, -1).map((entry) => entry.templateId);
    expect(bloodBuilds).not.toContain('flash-flood');
    expect(engineBuilds).not.toContain('constant-current');
    // The non-measurement track's full pool (including its own benchmark id)
    // is still available for build days.
    expect(bloodBuilds).toContain('constant-current');
    expect(engineBuilds).toContain('flash-flood');
  });
});
