import { WORKOUT_TEMPLATES, type WorkoutTemplate } from '@/data/workoutTemplates';
import { filterWorkoutTemplates } from '@/lib/workout/filterWorkoutTemplates';
import { templateToExercises } from '@/lib/workout/templateToExercises';
import { benchmarkTemplateIdFor } from './campaignBenchmarks';
import { orderPoolByVolume } from './campaignVolume';
import { MIN_WEEKS_FOR_DELOAD } from './constants';
import {
  CampaignValidationError,
  type CampaignOccurrence,
  type CampaignTrack,
  type PlannedCampaignOccurrence,
} from './types';

export interface PlanCampaignWorkoutsInput {
  occurrences: CampaignOccurrence[];
  /** The host's chosen tracks. The first one supplies the benchmark. */
  tracks: CampaignTrack[];
  /** Injectable for tests; defaults to the shipped library. */
  templates?: WorkoutTemplate[];
}

/**
 * Which weeks carry a test, by campaign length.
 *
 * Every campaign opens with a benchmark and closes by repeating it — that pair
 * is the campaign's result. Longer campaigns get a mid-point retest too, so the
 * crew sees movement before the end rather than waiting three months for one
 * number.
 */
const TEST_WEEKS: Record<number, number[]> = {
  2: [1, 2],
  4: [1, 4],
  6: [1, 3, 6],
  8: [1, 4, 8],
  12: [1, 6, 12],
};

function testWeeksFor(weekCount: number): number[] {
  return TEST_WEEKS[weekCount] ?? [1, weekCount];
}

function lastIndexInWeek(occurrences: CampaignOccurrence[], week: number): number {
  let found = -1;
  occurrences.forEach((occurrence, index) => {
    if (occurrence.weekNumber === week) {
      found = index;
    }
  });
  return found;
}

/**
 * Turns a campaign calendar into a programme.
 *
 * The library offers no intensity gradient below 20 minutes — every workout in
 * a 5/10/15-minute pool is the same tier — so progression here comes from three
 * places, in order of how much they matter:
 *
 *   1. **Repeating the benchmark.** An AMRAP measures itself: the same workout
 *      done twice, months apart, turns "get fitter" into a number. Nothing else
 *      in this function matters as much.
 *   2. **Building volume.** Each track's pool is walked lightest to heaviest
 *      rather than in library order, which ran downhill.
 *   3. **Backing off before a test.** Long campaigns drop the session before
 *      each retest to the lightest work available, so the test measures fitness
 *      rather than fatigue.
 */
export function planCampaignWorkouts(
  input: PlanCampaignWorkoutsInput
): PlannedCampaignOccurrence[] {
  const { occurrences, tracks, templates = WORKOUT_TEMPLATES } = input;

  if (tracks.length === 0) {
    throw new CampaignValidationError('Pick at least one workout style for the campaign.');
  }
  if (occurrences.length === 0) {
    return [];
  }

  const benchmarkId = benchmarkTemplateIdFor(tracks[0]);
  const benchmark = benchmarkId
    ? (templates.find((template) => template.id === benchmarkId) ?? null)
    : null;

  const pools = tracks.map((track) => {
    const pool = orderPoolByVolume(
      filterWorkoutTemplates(templates, {
        durationMinutes: track.durationMinutes,
        category: track.category,
      })
    );
    if (pool.length === 0) {
      throw new CampaignValidationError(
        `No workouts available for ${track.durationMinutes}-minute ${track.category}.`
      );
    }
    return pool;
  });

  // Without a benchmark for the leading track there is nothing to measure
  // against, so the campaign falls back to a plain build.
  if (!benchmark) {
    return buildOnly(occurrences, tracks, pools);
  }

  const weekCount = occurrences.reduce(
    (max, occurrence) => Math.max(max, occurrence.weekNumber),
    0
  );
  const [openingWeek, ...retestWeeks] = testWeeksFor(weekCount);

  const benchmarkIndex = occurrences.findIndex(
    (occurrence) => occurrence.weekNumber === openingWeek
  );
  const testIndices = new Set<number>();
  if (benchmarkIndex >= 0) {
    testIndices.add(benchmarkIndex);
  }
  for (const week of retestWeeks) {
    const index = lastIndexInWeek(occurrences, week);
    if (index >= 0) {
      testIndices.add(index);
    }
  }

  // The lightest sessions available, used to back off before a retest. The
  // benchmark is never one of them: an easy day running the test workout would
  // read as a third test, both to the crew and to deriveCampaignRoles.
  const deloadCandidates = orderPoolByVolume(pools.flat()).filter(
    (template) => template.id !== benchmark.id
  );

  const deloadIndices = new Set<number>();
  if (weekCount >= MIN_WEEKS_FOR_DELOAD) {
    for (const testIndex of testIndices) {
      const before = testIndex - 1;
      if (before > 0 && !testIndices.has(before)) {
        deloadIndices.add(before);
      }
    }
  }

  // The benchmark is kept out of the build rotation so the only times the crew
  // meets it are the tests.
  const buildPools = pools.map((pool) => pool.filter((template) => template.id !== benchmark.id));

  let buildIndex = 0;
  let previousId: string | null = null;

  return occurrences.map((occurrence, index) => {
    const planned = (() => {
      if (testIndices.has(index)) {
        return withTemplate(occurrence, benchmark, tracks[0]);
      }
      if (deloadIndices.has(index)) {
        // The lightest workout that is not the one just done — the build
        // rotation can wrap back to its own lightest right before a deload,
        // and two identical sessions in a row look like a mistake.
        const template =
          deloadCandidates.find((candidate) => candidate.id !== previousId) ?? deloadCandidates[0];
        return withTemplate(occurrence, template, tracks[0]);
      }

      const trackIndex = buildIndex % tracks.length;
      const pool = buildPools[trackIndex].length > 0 ? buildPools[trackIndex] : pools[trackIndex];
      const template = pool[Math.floor(buildIndex / tracks.length) % pool.length];
      buildIndex += 1;
      return withTemplate(occurrence, template, tracks[trackIndex]);
    })();

    previousId = planned.templateId;
    return planned;
  });
}

function buildOnly(
  occurrences: CampaignOccurrence[],
  tracks: CampaignTrack[],
  pools: WorkoutTemplate[][]
): PlannedCampaignOccurrence[] {
  return occurrences.map((occurrence, index) => {
    const trackIndex = index % tracks.length;
    const pool = pools[trackIndex];
    const template = pool[Math.floor(index / tracks.length) % pool.length];
    return withTemplate(occurrence, template, tracks[trackIndex]);
  });
}

function withTemplate(
  occurrence: CampaignOccurrence,
  template: WorkoutTemplate,
  track: CampaignTrack
): PlannedCampaignOccurrence {
  return {
    ...occurrence,
    templateId: template.id,
    workoutName: template.name,
    durationMinutes: template.durationMinutes,
    // The template's own category, not the track's: a deload may come from a
    // different track than the session it replaces.
    category: template.category ?? track.category,
    intensityTier: template.intensityTier,
    workout: templateToExercises(template),
  };
}
