import type { WorkoutExercise } from '@/lib/api/missionTypes';

/**
 * The room's workout collection: what this coach actually runs, offered back
 * so an athlete can train it on their own clock.
 *
 * Derived from the room's finished missions rather than a curated list. A room
 * cannot advertise a workout it has never run, and a collection built from
 * history cannot drift from a schedule nobody updated. The curated version —
 * `workout_publications`, the weekly window, standings — is Phase 3, and this
 * does not pre-empt it.
 *
 * **Launching runs the library's current version, not the historical one.**
 * The read carries the workout jsonb the room ran and this uses it — for the
 * duration shown, the unit, and whether the thing is scorable at all — but the
 * mission itself starts from `/create?template=`, which resolves against
 * `WORKOUT_TEMPLATES` as it is today.
 *
 * That is deliberate, and it is the narrower reading of the repo's snapshot
 * rule. Stored jsonb exists so a *recorded result* cannot be reinterpreted by
 * a later edit — that is what CLAUDE.md protects, and what the benchmark
 * fingerprints enforce. Starting a *new* mission is a different act: every
 * other surface that offers a template (the featured mission, campaign
 * previews, `/create`) launches the current version, and pinning here would
 * make the room collection the one place in the product that hands an athlete
 * a library version the product has since corrected.
 */

export interface RoomWorkout {
  /** Template id when the room ran one from the library; a content hash when not. */
  workoutKey: string;
  templateId: string | null;
  /**
   * The workout as the room ran it. Describes the entry — duration, unit,
   * whether it is scorable — and is not what a launch runs; see the note above.
   */
  workout: WorkoutExercise[];
  durationMinutes: number;
  intensityTier: number | null;
  scoreUnit: 'reps' | 'rounds';
  lastRun: string;
  finishers: number;
}

/**
 * What a collection entry reads as.
 *
 * Names the workout when the room used a template and falls back to the clock
 * when it did not, the same way every other room surface does — "12 min AMRAP"
 * still tells an athlete what they are in for.
 */
export function workoutLine(entry: RoomWorkout, workoutName?: string): string {
  return workoutName?.trim() || `${entry.durationMinutes} min AMRAP`;
}

/**
 * The second line: how many people in this room have finished it.
 *
 * Silent at zero rather than saying "0 athletes". A workout the room ran once
 * for nobody is not a recommendation, and printing the zero argues against the
 * very thing the collection is inviting.
 */
export function workoutFinishersLine(entry: RoomWorkout): string | null {
  if (entry.finishers <= 0) {
    return null;
  }
  return entry.finishers === 1
    ? '1 athlete has done this'
    : `${entry.finishers} athletes have done this`;
}

/**
 * Whether to show the section at all.
 *
 * Same rule as the activity list: an empty collection tells a visitor the room
 * has never run anything, which is true of every room on its first day and is
 * not the impression a coach is trying to make while they get it going.
 */
export function shouldShowCollection(entries: RoomWorkout[]): boolean {
  return entries.length > 0;
}

/**
 * Whether this entry can be handed to the existing solo-mission flow.
 *
 * Two conditions, for two different reasons.
 *
 * A **template id**, because `/create?template=<id>` is the only way to carry a
 * workout into that page today, and it is the guest-friendly one — no account,
 * no gate, and it already asks for a name. Every room workout has a template id
 * right now: `ScheduleMissionForm` only offers the library. The content-hashed
 * key exists for the day that stops being true, and this is what keeps that day
 * from shipping a dead button.
 *
 * A **scorable workout**, because the mission would otherwise run a clock whose
 * rounds cannot be counted. A coach may legitimately have improvised one; that
 * is worth showing in the collection and not worth offering back as a solo
 * mission.
 */
export function isLaunchable(entry: RoomWorkout): boolean {
  return entry.templateId !== null && entry.scoreUnit === 'reps' && entry.workout.length > 0;
}

/** Where the launch button goes: the existing flow, with the workout chosen. */
export function launchHref(entry: RoomWorkout): string | null {
  return isLaunchable(entry) ? `/create?template=${encodeURIComponent(entry.templateId!)}` : null;
}
