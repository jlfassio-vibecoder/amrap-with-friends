import { describe, it, expect } from 'vitest';
import {
  checkScheduledAt,
  hostNicknameFor,
  HOST_NICKNAME_MAX,
  isOpenMission,
  nextMission,
  nextMissionLabel,
  repeatableMission,
  sameTimeNextWeek,
  type RoomMissionLike,
} from './roomSchedule';

function mission(over: Partial<RoomMissionLike> = {}): RoomMissionLike {
  return {
    missionId: 'm1',
    state: 'waiting',
    durationMinutes: 12,
    templateId: 'the-piston',
    scheduledAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    finishers: 0,
    ...over,
  };
}

describe('nextMission', () => {
  it('is nothing when the room has never run one', () => {
    expect(nextMission([])).toBeNull();
    expect(nextMission([mission({ state: 'finished' })])).toBeNull();
  });

  // A host looking at the dashboard mid-mission wants that mission.
  it('prefers a mission already running over one scheduled later', () => {
    const running = mission({ missionId: 'live', state: 'work' });
    const later = mission({ missionId: 'later', scheduledAt: '2026-09-20T17:00:00.000Z' });
    expect(nextMission([later, running])?.missionId).toBe('live');
  });

  it('picks the soonest of several scheduled', () => {
    const missions = [
      mission({ missionId: 'c', scheduledAt: '2026-09-22T17:00:00.000Z' }),
      mission({ missionId: 'a', scheduledAt: '2026-09-20T17:00:00.000Z' }),
      mission({ missionId: 'b', scheduledAt: '2026-09-21T17:00:00.000Z' }),
    ];
    expect(nextMission(missions)?.missionId).toBe('a');
  });

  // No time means it is open right now, which is sooner than any date.
  it('puts an undated open mission ahead of a dated one', () => {
    const dated = mission({ missionId: 'dated', scheduledAt: '2026-09-20T17:00:00.000Z' });
    const now = mission({ missionId: 'now', scheduledAt: null });
    expect(nextMission([dated, now])?.missionId).toBe('now');
  });

  it('ignores finished missions entirely', () => {
    expect(nextMission([mission({ state: 'finished', finishers: 5 })])).toBeNull();
  });
});

describe('repeatableMission', () => {
  // Offering back a mission nobody finished is how a room repeats an empty slot.
  it('skips a finished mission nobody completed', () => {
    expect(repeatableMission([mission({ state: 'finished', finishers: 0 })])).toBeNull();
  });

  it('takes the most recent finished mission that someone completed', () => {
    const old = mission({
      missionId: 'old',
      state: 'finished',
      finishers: 3,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    const recent = mission({
      missionId: 'recent',
      state: 'finished',
      finishers: 1,
      createdAt: '2026-09-08T00:00:00.000Z',
    });
    expect(repeatableMission([old, recent])?.missionId).toBe('recent');
  });

  it('ignores missions still open', () => {
    expect(repeatableMission([mission({ state: 'waiting', finishers: 0 })])).toBeNull();
  });
});

describe('isOpenMission', () => {
  it('counts every state an athlete could still be in', () => {
    for (const state of ['waiting', 'setup', 'work']) {
      expect(isOpenMission(mission({ state })), state).toBe(true);
    }
    expect(isOpenMission(mission({ state: 'finished' }))).toBe(false);
  });
});

describe('sameTimeNextWeek', () => {
  it('moves seven days and keeps the clock time', () => {
    const from = new Date('2026-09-15T17:30:00.000Z');
    const next = sameTimeNextWeek(from);
    expect(next.toISOString()).toBe('2026-09-22T17:30:00.000Z');
  });

  it('does not mutate the date it was given', () => {
    const from = new Date('2026-09-15T17:30:00.000Z');
    sameTimeNextWeek(from);
    expect(from.toISOString()).toBe('2026-09-15T17:30:00.000Z');
  });
});

describe('checkScheduledAt', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('accepts a time inside the horizon', () => {
    expect(checkScheduledAt(new Date('2026-09-22T17:00:00.000Z'), now, 60)).toBeNull();
  });

  it('refuses the past, and the present', () => {
    expect(checkScheduledAt(new Date('2026-09-14T12:00:00.000Z'), now, 60)?.reason).toBe('past');
    expect(checkScheduledAt(now, now, 60)?.reason).toBe('past');
  });

  it('refuses beyond the horizon and says how far it reaches', () => {
    const far = checkScheduledAt(new Date('2026-12-01T12:00:00.000Z'), now, 60);
    expect(far?.reason).toBe('too_far');
    expect(far?.message).toContain('60 days');
  });
});

describe('nextMissionLabel', () => {
  it('says so when there is nothing', () => {
    expect(nextMissionLabel(null)).toBe('Nothing scheduled.');
  });

  it('says a running mission is running', () => {
    expect(nextMissionLabel(mission({ state: 'work' }))).toBe('Running now.');
  });

  it('says an undated one is open now', () => {
    expect(nextMissionLabel(mission({ state: 'waiting' }))).toBe('Open now — athletes can join.');
  });

  it('formats a scheduled time for the viewer', () => {
    const label = nextMissionLabel(mission({ scheduledAt: '2026-09-22T17:00:00.000Z' }), 'en-US');
    expect(label).toMatch(/Sep/);
    expect(label).not.toBe('Nothing scheduled.');
  });
});

describe('repeatableMission orders by completion, not creation', () => {
  /**
   * The case that made created_at wrong: a mission scheduled on Monday for next
   * Tuesday is *created* before one that is created and run on Wednesday, so
   * sorting by creation offers back the older one.
   */
  it('prefers the one finished most recently', () => {
    const scheduledEarlyRunLate = mission({
      missionId: 'tuesday',
      state: 'finished',
      finishers: 4,
      createdAt: '2026-09-07T09:00:00.000Z',
      completedAt: '2026-09-15T18:00:00.000Z',
    });
    const createdLateRunFirst = mission({
      missionId: 'wednesday',
      state: 'finished',
      finishers: 2,
      createdAt: '2026-09-09T09:00:00.000Z',
      completedAt: '2026-09-09T18:00:00.000Z',
    });
    expect(repeatableMission([scheduledEarlyRunLate, createdLateRunFirst])?.missionId).toBe(
      'tuesday'
    );
  });

  it('falls back to creation when a completion time is missing', () => {
    const older = mission({
      missionId: 'a',
      state: 'finished',
      finishers: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    const newer = mission({
      missionId: 'b',
      state: 'finished',
      finishers: 1,
      createdAt: '2026-09-08T00:00:00.000Z',
    });
    expect(repeatableMission([older, newer])?.missionId).toBe('b');
  });
});

describe('hostNicknameFor', () => {
  // A room name may be 80 characters; schedule_room_mission caps a nickname at
  // 50. Without this, a room with a long name could not schedule anything.
  it('passes a short room name through unchanged', () => {
    expect(hostNicknameFor('Bay Area CrossFit')).toBe('Bay Area CrossFit');
  });

  it('trims a name too long for the nickname limit', () => {
    const long = 'A'.repeat(80);
    const nickname = hostNicknameFor(long);
    expect(nickname.length).toBeLessThanOrEqual(HOST_NICKNAME_MAX);
    expect(nickname.endsWith('…')).toBe(true);
  });

  it('does not leave a dangling space before the ellipsis', () => {
    const nickname = hostNicknameFor(`${'B'.repeat(48)} tail words here`);
    expect(nickname).not.toContain(' …');
  });
});
