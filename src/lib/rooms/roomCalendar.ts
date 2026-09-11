import type { CalendarEventInput } from '@/lib/calendar/buildCalendarEvent';
import type { RoomMissionLike } from '@/lib/rooms/roomSchedule';

export interface RoomCalendarInput {
  roomHandle: string;
  roomDisplayName: string;
  mission: RoomMissionLike;
  /** The workout's own name, when the room ran one from the library. */
  workoutName?: string;
  /** Where the links point. `window.location.origin` in the app. */
  origin: string;
}

/**
 * The calendar entry for a room's next mission, or null when there is nothing
 * to put in a calendar.
 *
 * Null is the common answer, and that is the point. A mission already running
 * cannot be attended later, and one that is open with no time is happening
 * now — an "add to calendar" button on either puts an event in the athlete's
 * week for a thing that will be over before they look at it. Only a mission
 * with a time, still in the future, is worth saving.
 *
 * Deliberately one occurrence and no RRULE. The room's schedule is a list of
 * generated missions rather than a recurrence the athlete's calendar could
 * track, so a recurring event would go stale the moment the coach changed
 * anything, with no way for the saved copy to find out.
 */
export function roomMissionCalendarEvent(
  input: RoomCalendarInput,
  now: Date = new Date()
): CalendarEventInput | null {
  const { mission } = input;
  if (mission.state !== 'waiting' || mission.scheduledAt === null) {
    return null;
  }

  const startsAt = new Date(mission.scheduledAt);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now.getTime()) {
    return null;
  }

  const room = input.roomDisplayName.trim() || `@${input.roomHandle}`;
  // The workout when the room ran one from the library, the clock when it did
  // not. "Mission" alone in a week of calendar entries says nothing.
  const what = input.workoutName?.trim() || `${mission.durationMinutes} min AMRAP`;
  const missionUrl = `${input.origin}/mission/${mission.missionId}`;

  return {
    // The mission id: saving the same mission twice updates the entry rather
    // than adding a second one, in every calendar that dedupes on UID.
    uid: mission.missionId,
    title: `Mission: ${what} · ${room}`,
    description: [
      `${mission.durationMinutes} minute AMRAP with ${room}.`,
      `Join: ${missionUrl}`,
      `Room: ${input.origin}/@${input.roomHandle}`,
    ].join('\n'),
    startsAt,
    durationMinutes: mission.durationMinutes,
    location: missionUrl,
    url: missionUrl,
  };
}

/** What the athlete sees in their downloads. */
export function roomIcsFileName(roomHandle: string): string {
  return `${roomHandle}-mission.ics`;
}
