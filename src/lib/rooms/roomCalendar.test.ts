import { describe, expect, it } from 'vitest';
import { buildIcsFileContent } from '@/lib/calendar/buildCalendarEvent';
import { roomIcsFileName, roomMissionCalendarEvent } from '@/lib/rooms/roomCalendar';
import type { RoomMissionLike } from '@/lib/rooms/roomSchedule';

const NOW = new Date('2026-09-11T12:00:00.000Z');

function mission(overrides: Partial<RoomMissionLike> = {}): RoomMissionLike {
  return {
    missionId: 'm1',
    state: 'waiting',
    durationMinutes: 12,
    templateId: 'blood-shunt',
    scheduledAt: '2026-09-15T17:30:00.000Z',
    createdAt: '2026-09-11T10:00:00.000Z',
    finishers: 0,
    ...overrides,
  };
}

function build(overrides: Partial<RoomMissionLike> = {}, workoutName = 'Blood Shunt') {
  return roomMissionCalendarEvent(
    {
      roomHandle: 'northside',
      roomDisplayName: 'Northside Strength',
      mission: mission(overrides),
      workoutName,
      origin: 'https://amrapwithfriends.com',
    },
    NOW
  );
}

describe('roomMissionCalendarEvent', () => {
  it('names the workout and the room', () => {
    const event = build();
    expect(event?.title).toBe('Mission: Blood Shunt · Northside Strength');
  });

  it('falls back to the clock when the room ran its own workout', () => {
    expect(build({}, '')?.title).toBe('Mission: 12 min AMRAP · Northside Strength');
    expect(
      roomMissionCalendarEvent(
        {
          roomHandle: 'northside',
          roomDisplayName: 'Northside Strength',
          mission: mission(),
          origin: 'https://amrapwithfriends.com',
        },
        NOW
      )?.title
    ).toBe('Mission: 12 min AMRAP · Northside Strength');
  });

  it('carries the join link and the room address', () => {
    const event = build();
    expect(event?.description).toContain('Join: https://amrapwithfriends.com/mission/m1');
    expect(event?.description).toContain('Room: https://amrapwithfriends.com/@northside');
    expect(event?.location).toBe('https://amrapwithfriends.com/mission/m1');
  });

  it('keys the entry to the mission, so saving twice does not duplicate', () => {
    expect(build()?.uid).toBe('m1');
  });

  it('offers nothing for a mission that is already running', () => {
    expect(build({ state: 'work' })).toBeNull();
    expect(build({ state: 'setup' })).toBeNull();
  });

  it('offers nothing for a mission that is over', () => {
    expect(build({ state: 'finished' })).toBeNull();
  });

  it('offers nothing for a mission that is open now with no time', () => {
    // It is happening now. An entry for it lands in the athlete's week after
    // the thing it describes has finished.
    expect(build({ scheduledAt: null })).toBeNull();
  });

  it('offers nothing for a time that has already passed', () => {
    expect(build({ scheduledAt: '2026-09-11T11:59:00.000Z' })).toBeNull();
  });

  it('offers nothing for an unparseable time rather than an invalid event', () => {
    expect(build({ scheduledAt: 'next tuesday' })).toBeNull();
  });

  it('falls back to the handle when a room has no display name', () => {
    const event = roomMissionCalendarEvent(
      {
        roomHandle: 'northside',
        roomDisplayName: '   ',
        mission: mission(),
        workoutName: 'Blood Shunt',
        origin: 'https://amrapwithfriends.com',
      },
      NOW
    );
    expect(event?.title).toBe('Mission: Blood Shunt · @northside');
  });
});

describe('the instant an athlete in another zone gets', () => {
  it('is the room’s instant, across a daylight-saving boundary', () => {
    // The roadmap's own gate. A room in New York schedules 18:30 local on
    // either side of the November change; the stored instant differs by an
    // hour in UTC, and the .ics must carry each one exactly -- a viewer in
    // London saving both should see 22:30 and then 23:30, not 22:30 twice.
    const beforeDst = build({ missionId: 'm-oct', scheduledAt: '2026-10-20T22:30:00.000Z' });
    const afterDst = build({ missionId: 'm-nov', scheduledAt: '2026-11-17T23:30:00.000Z' });

    expect(buildIcsFileContent(beforeDst!)).toContain('DTSTART:20261020T223000Z');
    expect(buildIcsFileContent(afterDst!)).toContain('DTSTART:20261117T233000Z');
  });

  it('ends the event at the cap, not at some default hour', () => {
    const ics = buildIcsFileContent(build({ durationMinutes: 20 })!);
    expect(ics).toContain('DTSTART:20260915T173000Z');
    expect(ics).toContain('DTEND:20260915T175000Z');
  });
});

describe('roomIcsFileName', () => {
  it('says which room it came from', () => {
    expect(roomIcsFileName('northside')).toBe('northside-mission.ics');
  });
});
