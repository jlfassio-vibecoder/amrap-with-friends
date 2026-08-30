import { WORKOUT_CATEGORIES } from '@/data/workoutTemplates';
import { categoryDisplayForDuration } from '@/lib/workout/filterWorkoutTemplates';
import type { CampaignTrack } from '@/lib/campaign';

/** Display label for a track chip — also used on the create page “Measured on” line. */
export function campaignTrackLabel(track: CampaignTrack): string {
  const meta = WORKOUT_CATEGORIES.find((category) => category.id === track.category);
  const display = meta
    ? categoryDisplayForDuration(meta, track.durationMinutes).label
    : track.category;
  return `${display} · ${track.durationMinutes} min`;
}
