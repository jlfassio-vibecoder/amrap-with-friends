import type { RoomMissionLike } from '@/lib/rooms/roomSchedule';

/**
 * "Why come back" — the third question the room page answers.
 *
 * A list of finished missions is only worth showing if it looks like a room
 * that runs. Missions nobody completed are noise: they are usually one opened
 * and abandoned, and a page full of them argues against joining.
 */

export interface RoomActivityRow {
  missionId: string;
  /** What the workout was, when we know it. */
  templateId: string | null;
  durationMinutes: number;
  finishers: number;
  at: string;
}

export function recentActivity(missions: RoomMissionLike[], limit = 5): RoomActivityRow[] {
  return missions
    .filter((mission) => mission.state === 'finished' && mission.finishers > 0)
    .slice(0, Math.max(0, limit))
    .map((mission) => ({
      missionId: mission.missionId,
      templateId: mission.templateId,
      durationMinutes: mission.durationMinutes,
      finishers: mission.finishers,
      at: mission.completedAt ?? mission.createdAt,
    }));
}

/**
 * How a finished mission reads on the page.
 *
 * Names the workout when the room used a template and falls back to the
 * duration when it did not, because "12 min AMRAP" still tells an athlete what
 * they would have been in for.
 */
export function activityLine(row: RoomActivityRow, workoutName?: string): string {
  const what = workoutName ?? `${row.durationMinutes} min AMRAP`;
  const who = `${row.finishers} ${row.finishers === 1 ? 'athlete' : 'athletes'}`;
  return `${what} · ${who} finished`;
}

/**
 * Whether the page should show the activity section at all.
 *
 * An empty list is worse than no section: it tells a visitor the room has
 * never run anything, which is true of every room on its first day and is not
 * the impression a coach is trying to make while they get it going.
 */
export function shouldShowActivity(rows: RoomActivityRow[]): boolean {
  return rows.length > 0;
}
