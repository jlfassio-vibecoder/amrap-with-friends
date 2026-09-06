import type { IntensityTier } from '@/data/workoutTemplates';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type { MissionTimeCap } from '@/lib/timeDomains';

/** Local Create-page draft row before `set_mission_chain`. */
export type ChainDraftItem = {
  id: string;
  name: string;
  durationMinutes: MissionTimeCap;
  intensityTier: IntensityTier;
  templateId: string;
  /** Programmed template minute — for TimeCapControl off-template warning. */
  templateCap: MissionTimeCap;
  workout: WorkoutExercise[];
};

export function createChainDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chain-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
