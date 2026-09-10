import { describe, expect, it } from 'vitest';
import {
  addOneCalendarDay,
  calendarDateInTimeZone,
  isRallyTimeAllowed,
  rallyIsoToDayAndTime,
  rallyLocalDateTimeToIso,
} from './rallySchedule';

const TZ = 'America/Los_Angeles';

describe('rallySchedule', () => {
  it('formats calendar dates in the host timezone', () => {
    const now = new Date('2026-08-25T06:00:00.000Z');
    expect(calendarDateInTimeZone(now, TZ)).toBe('2026-08-24');
    expect(addOneCalendarDay('2026-08-24')).toBe('2026-08-25');
  });

  it('allows today and tomorrow in the host timezone and rejects past or later days', () => {
    const now = new Date('2026-08-25T04:00:00.000Z');

    expect(isRallyTimeAllowed('2026-08-25T05:00:00.000Z', TZ, now)).toBe(true);
    expect(isRallyTimeAllowed('2026-08-26T06:59:00.000Z', TZ, now)).toBe(true);
    expect(isRallyTimeAllowed('2026-08-25T03:00:00.000Z', TZ, now)).toBe(false);
    expect(isRallyTimeAllowed('2026-08-27T04:00:00.000Z', TZ, now)).toBe(false);
  });

  it('builds an ISO timestamp from today/tomorrow + local time', () => {
    const now = new Date('2026-08-25T04:00:00.000Z');
    const todayIso = rallyLocalDateTimeToIso('today', '22:00', TZ, now);
    const tomorrowIso = rallyLocalDateTimeToIso('tomorrow', '09:30', TZ, now);

    expect(todayIso).toBe('2026-08-25T05:00:00.000Z');
    expect(tomorrowIso).toBe('2026-08-25T16:30:00.000Z');
    expect(todayIso && isRallyTimeAllowed(todayIso, TZ, now)).toBe(true);
    expect(tomorrowIso && isRallyTimeAllowed(tomorrowIso, TZ, now)).toBe(true);
  });

  it('rallyIsoToDayAndTime inverts today and tomorrow rally ISO values', () => {
    const now = new Date('2026-08-25T04:00:00.000Z');
    const todayIso = rallyLocalDateTimeToIso('today', '22:00', TZ, now);
    const tomorrowIso = rallyLocalDateTimeToIso('tomorrow', '09:30', TZ, now);

    expect(todayIso && rallyIsoToDayAndTime(todayIso, TZ, now)).toEqual({
      day: 'today',
      time: '22:00',
    });
    expect(tomorrowIso && rallyIsoToDayAndTime(tomorrowIso, TZ, now)).toEqual({
      day: 'tomorrow',
      time: '09:30',
    });
    expect(rallyIsoToDayAndTime('2026-08-27T04:00:00.000Z', TZ, now)).toBeNull();
  });
});
