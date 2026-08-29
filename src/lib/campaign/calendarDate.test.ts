import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  calendarDateToday,
  isCalendarDate,
  isLocalTime,
  weekdayOf,
} from './calendarDate';

describe('isCalendarDate', () => {
  it('accepts a real date', () => {
    expect(isCalendarDate('2026-03-08')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isCalendarDate('2026-3-8')).toBe(false);
    expect(isCalendarDate('08-03-2026')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });

  it('rejects a day that does not exist', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
  });

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });
});

describe('isLocalTime', () => {
  it('accepts 24-hour times', () => {
    expect(isLocalTime('00:00')).toBe(true);
    expect(isLocalTime('06:30')).toBe(true);
    expect(isLocalTime('23:59')).toBe(true);
  });

  it('rejects out-of-range or malformed times', () => {
    expect(isLocalTime('24:00')).toBe(false);
    expect(isLocalTime('6:30')).toBe(false);
    expect(isLocalTime('18:60')).toBe(false);
    expect(isLocalTime('18:30:00')).toBe(false);
  });
});

describe('addCalendarDays', () => {
  it('adds days within a month', () => {
    expect(addCalendarDays('2026-03-08', 3)).toBe('2026-03-11');
  });

  it('rolls over a month boundary', () => {
    expect(addCalendarDays('2026-01-30', 5)).toBe('2026-02-04');
  });

  it('rolls over a year boundary', () => {
    expect(addCalendarDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('handles a leap day', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2028-02-28', 2)).toBe('2028-03-01');
  });

  it('subtracts with a negative offset', () => {
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('keeps the weekday stable across a US spring-forward boundary', () => {
    // 2026-03-08 is the US DST switch. Adding a week must stay a Sunday.
    expect(weekdayOf('2026-03-08')).toBe(0);
    expect(weekdayOf(addCalendarDays('2026-03-08', 7))).toBe(0);
  });

  it('keeps the weekday stable across a US fall-back boundary', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(weekdayOf(addCalendarDays('2026-11-01', 7))).toBe(0);
  });

  it('lands on the same weekday for every week of a 12-week span', () => {
    const start = '2026-10-05';
    const startDay = weekdayOf(start);
    for (let week = 0; week < 12; week += 1) {
      expect(weekdayOf(addCalendarDays(start, week * 7))).toBe(startDay);
    }
  });
});

describe('weekdayOf', () => {
  it('maps 0 to Sunday and 6 to Saturday', () => {
    expect(weekdayOf('2026-03-08')).toBe(0);
    expect(weekdayOf('2026-03-09')).toBe(1);
    expect(weekdayOf('2026-03-14')).toBe(6);
  });
});

describe('calendarDateToday', () => {
  it('formats the local date, zero padded', () => {
    expect(calendarDateToday(new Date(2026, 9, 5, 12, 0, 0))).toBe('2026-10-05');
    expect(calendarDateToday(new Date(2026, 0, 9, 12, 0, 0))).toBe('2026-01-09');
  });

  it('uses local parts, so a late evening does not report tomorrow', () => {
    // 23:30 local on the 5th is already the 6th in UTC at a negative offset.
    expect(calendarDateToday(new Date(2026, 9, 5, 23, 30, 0))).toBe('2026-10-05');
  });
});
