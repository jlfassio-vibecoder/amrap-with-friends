import type { WorkoutTemplate } from '@/data/workoutTemplates';

/**
 * Total prescribed reps in one round. The only difficulty gradient the library
 * actually offers below 20 minutes — every workout in a 5/10/15-minute pool
 * carries the same intensity tier, so volume is what separates them.
 *
 * Timed holds count as one rep per second, matching computeRepsPerRound.
 */
export function repsPerRound(template: WorkoutTemplate): number {
  return template.movements.reduce((total, movement) => total + (movement.reps ?? 0), 0);
}

/**
 * A pool ordered lightest to heaviest, so walking it across a campaign builds
 * rather than declines. Ties keep their library order, which makes the result
 * stable for a given library.
 */
export function orderPoolByVolume(pool: WorkoutTemplate[]): WorkoutTemplate[] {
  return [...pool].sort((a, b) => repsPerRound(a) - repsPerRound(b));
}
