import { WORKOUT_TEMPLATES, type WorkoutTemplate } from '@/data/workoutTemplates';
import { filterWorkoutTemplates } from '@/lib/workout/filterWorkoutTemplates';
import { templateToExercises } from '@/lib/workout/templateToExercises';
import {
  CampaignValidationError,
  type CampaignOccurrence,
  type CampaignTrack,
  type PlannedCampaignOccurrence,
} from './types';

export interface AssignCampaignWorkoutsInput {
  occurrences: CampaignOccurrence[];
  /** The (duration, category) pairs the host wants to train. At least one. */
  tracks: CampaignTrack[];
  /** Injectable for tests; defaults to the shipped library. */
  templates?: WorkoutTemplate[];
}

function trackLabel(track: CampaignTrack): string {
  return `${track.durationMinutes}-minute ${track.category}`;
}

/**
 * Fills a campaign calendar with workouts.
 *
 * Sixty hand-picked workouts is not a create screen anyone finishes, so the
 * host picks tracks and this seeds every occurrence. Two properties matter:
 *
 * - **Deterministic.** The same input always produces the same plan, so the
 *   host can preview a campaign before saving it and see exactly what they
 *   agreed to.
 * - **Varied.** Sessions round-robin across tracks, and each track walks its
 *   own pool in order before repeating. With three tracks of ten templates,
 *   nothing repeats for thirty sessions.
 *
 * Any single occurrence can be overridden afterwards; this only supplies the
 * starting plan.
 */
export function assignCampaignWorkouts(
  input: AssignCampaignWorkoutsInput
): PlannedCampaignOccurrence[] {
  const { occurrences, tracks, templates = WORKOUT_TEMPLATES } = input;

  if (tracks.length === 0) {
    throw new CampaignValidationError('Pick at least one workout style for the campaign.');
  }

  const pools = tracks.map((track) => {
    const pool = filterWorkoutTemplates(templates, {
      durationMinutes: track.durationMinutes,
      category: track.category,
    });
    if (pool.length === 0) {
      throw new CampaignValidationError(`No workouts available for ${trackLabel(track)}.`);
    }
    return pool;
  });

  return occurrences.map((occurrence, index) => {
    const trackIndex = index % tracks.length;
    const pool = pools[trackIndex];
    // How many times this track has already come round, so each track walks
    // its own pool independently of how many tracks there are.
    const passIndex = Math.floor(index / tracks.length);
    const template = pool[passIndex % pool.length];

    return {
      ...occurrence,
      templateId: template.id,
      workoutName: template.name,
      durationMinutes: template.durationMinutes,
      category: tracks[trackIndex].category,
      intensityTier: template.intensityTier,
      workout: templateToExercises(template),
    };
  });
}
