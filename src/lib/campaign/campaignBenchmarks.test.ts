import { describe, expect, it } from 'vitest';
import { TIME_DOMAINS, WORKOUT_CATEGORIES, WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { filterWorkoutTemplates } from '@/lib/workout/filterWorkoutTemplates';
import {
  allBenchmarkTemplateIds,
  allBenchmarkTrackKeys,
  benchmarkTemplateIdFor,
  campaignTrackKey,
} from './campaignBenchmarks';

/** Every (duration, category) pair the library actually has workouts for. */
const VALID_TRACKS = TIME_DOMAINS.flatMap((durationMinutes) =>
  WORKOUT_CATEGORIES.filter(
    (category) =>
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes,
        category: category.id,
      }).length > 0
  ).map((category) => ({ durationMinutes, category: category.id }))
);

describe('campaignBenchmarks', () => {
  it('names a benchmark for every track a host can pick', () => {
    const missing = VALID_TRACKS.filter((track) => benchmarkTemplateIdFor(track) === null);
    expect(missing).toEqual([]);
  });

  it('names no benchmark for a track the library cannot fill', () => {
    // Aerobic Matrix is 20-minute only.
    expect(benchmarkTemplateIdFor({ durationMinutes: 5, category: 'aerobic-matrix' })).toBeNull();
  });

  it('points every benchmark at a workout that still exists', () => {
    const known = new Set(WORKOUT_TEMPLATES.map((template) => template.id));
    const dangling = allBenchmarkTemplateIds().filter((id) => !known.has(id));
    expect(dangling).toEqual([]);
  });

  it('puts each benchmark in the track it claims to test', () => {
    for (const track of VALID_TRACKS) {
      const id = benchmarkTemplateIdFor(track);
      const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
      expect(
        template,
        `no template for ${campaignTrackKey(track.durationMinutes, track.category)}`
      ).toBeDefined();
      expect(template?.durationMinutes).toBe(track.durationMinutes);
      expect(template?.category).toBe(track.category);
    }
  });

  it('uses a different workout for every track', () => {
    const ids = allBenchmarkTemplateIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries no entry for a track that does not exist', () => {
    const valid = new Set(
      VALID_TRACKS.map((track) => campaignTrackKey(track.durationMinutes, track.category))
    );
    const orphans = allBenchmarkTrackKeys().filter((key) => !valid.has(key));
    expect(orphans).toEqual([]);
  });
});
