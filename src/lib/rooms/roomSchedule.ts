/**
 * What a room's mission list means to the host looking at it.
 *
 * The dashboard answers two questions from one list: what is coming next, and
 * what would "run this again" repeat. Both are decisions about ordering and
 * state rather than rendering, so they live here and are tested without a
 * component.
 */

export interface RoomMissionLike {
  missionId: string;
  state: string;
  durationMinutes: number;
  templateId: string | null;
  scheduledAt: string | null;
  createdAt: string;
  finishers: number;
}

/** Anything an athlete could still join or is already in. */
const OPEN_STATES = new Set(['waiting', 'setup', 'work']);

export function isOpenMission(mission: RoomMissionLike): boolean {
  return OPEN_STATES.has(mission.state);
}

/**
 * The next mission the room will run.
 *
 * A mission already running beats one scheduled for later -- a host looking at
 * the dashboard mid-session should see the session, not next Tuesday. Among
 * scheduled ones, the soonest wins; a mission with no time is open now and
 * sorts ahead of anything dated.
 */
export function nextMission(missions: RoomMissionLike[]): RoomMissionLike | null {
  const open = missions.filter(isOpenMission);
  if (open.length === 0) {
    return null;
  }

  const live = open.find((mission) => mission.state === 'setup' || mission.state === 'work');
  if (live) {
    return live;
  }

  return [...open].sort((a, b) => {
    if (a.scheduledAt === null && b.scheduledAt === null) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    if (a.scheduledAt === null) {
      return -1;
    }
    if (b.scheduledAt === null) {
      return 1;
    }
    return a.scheduledAt.localeCompare(b.scheduledAt);
  })[0] as RoomMissionLike;
}

/**
 * The workout "run this again" repeats: the most recent finished mission that
 * anyone actually completed.
 *
 * A mission nobody finished is not a session worth repeating -- it is usually
 * one that was opened and abandoned, and offering it back is how a room ends up
 * running the same empty slot every week.
 */
export function repeatableMission(missions: RoomMissionLike[]): RoomMissionLike | null {
  const finished = missions
    .filter((mission) => mission.state === 'finished' && mission.finishers > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return finished[0] ?? null;
}

/** Same day next week, at the same wall-clock time, in whatever zone the caller passes. */
export function sameTimeNextWeek(from: Date): Date {
  const next = new Date(from.getTime());
  next.setDate(next.getDate() + 7);
  return next;
}

export interface ScheduleRejection {
  reason: 'past' | 'too_far';
  message: string;
}

/**
 * Whether a chosen time is one the server will accept, checked here so a host
 * is told before they submit. The server checks it too -- it is the boundary.
 */
export function checkScheduledAt(
  when: Date,
  now: Date,
  horizonDays: number
): ScheduleRejection | null {
  if (when.getTime() <= now.getTime()) {
    return { reason: 'past', message: 'Pick a time in the future.' };
  }
  const horizon = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  if (when.getTime() > horizon) {
    return {
      reason: 'too_far',
      message: `Schedule within the next ${horizonDays} days.`,
    };
  }
  return null;
}

/** How the next mission reads on the dashboard, in the viewer's own zone. */
export function nextMissionLabel(mission: RoomMissionLike | null, locale?: string): string {
  if (!mission) {
    return 'Nothing scheduled.';
  }
  if (mission.state === 'setup' || mission.state === 'work') {
    return 'Running now.';
  }
  if (mission.scheduledAt === null) {
    return 'Open now — athletes can join.';
  }
  const when = new Date(mission.scheduledAt);
  return when.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
