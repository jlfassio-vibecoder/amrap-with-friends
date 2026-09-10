import { describe, expect, it } from 'vitest';
import { buildCampaignCalendar } from './buildCampaignCalendar';
import { weekdayOf } from './calendarDate';
import { CampaignValidationError, type CampaignScheduleInput } from './types';

// 2026-03-02 is a Monday.
const MONDAY = '2026-03-02';

function input(overrides: Partial<CampaignScheduleInput> = {}): CampaignScheduleInput {
  return {
    weekCount: 4,
    startDate: MONDAY,
    slots: [
      { weekday: 1, timeLocal: '18:00' },
      { weekday: 4, timeLocal: '06:30' },
    ],
    ...overrides,
  };
}

describe('buildCampaignCalendar', () => {
  it('expands weeks x slots into one occurrence each', () => {
    const calendar = buildCampaignCalendar(input());
    expect(calendar.totalMissions).toBe(8);
    expect(calendar.missionsPerWeek).toBe(2);
    expect(calendar.occurrences).toHaveLength(8);
  });

  it('numbers sequence continuously and week/slot within the pattern', () => {
    const calendar = buildCampaignCalendar(input());
    expect(calendar.occurrences.map((o) => o.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(calendar.occurrences.map((o) => o.weekNumber)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(calendar.occurrences.map((o) => o.slotNumber)).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
  });

  it('starts week 1 on the start date and spaces weeks seven days apart', () => {
    const calendar = buildCampaignCalendar(input());
    expect(calendar.occurrences[0].localDate).toBe('2026-03-02');
    expect(calendar.occurrences[1].localDate).toBe('2026-03-05');
    expect(calendar.occurrences[2].localDate).toBe('2026-03-09');
    expect(calendar.occurrences[3].localDate).toBe('2026-03-12');
  });

  it('carries each slot local time through unchanged', () => {
    const calendar = buildCampaignCalendar(input());
    expect(calendar.occurrences[0].localTime).toBe('18:00');
    expect(calendar.occurrences[1].localTime).toBe('06:30');
  });

  it('reports the first and last mission dates, not just the anchor', () => {
    const calendar = buildCampaignCalendar(input());
    expect(calendar.anchorDate).toBe(MONDAY);
    expect(calendar.firstMissionDate).toBe(MONDAY);
    expect(calendar.lastMissionDate).toBe('2026-03-26');
  });

  it('distinguishes the anchor from the first mission when they differ', () => {
    // Anchored to a Sunday with a Monday slot: the campaign is described by
    // the Monday, because that is the day anyone actually trains.
    const calendar = buildCampaignCalendar(
      input({ weekCount: 2, startDate: '2026-03-01', slots: [{ weekday: 1, timeLocal: '18:00' }] })
    );
    expect(calendar.anchorDate).toBe('2026-03-01');
    expect(calendar.firstMissionDate).toBe('2026-03-02');
    expect(calendar.lastMissionDate).toBe('2026-03-09');
  });

  it('never schedules before the start date when a slot day precedes it', () => {
    // Starting Thursday with a Monday slot: week 1's Monday is the following one.
    const calendar = buildCampaignCalendar(
      input({ startDate: '2026-03-05', slots: [{ weekday: 1, timeLocal: '07:00' }] })
    );
    expect(weekdayOf('2026-03-05')).toBe(4);
    expect(calendar.occurrences[0].localDate).toBe('2026-03-09');
    expect(calendar.occurrences.every((occurrence) => occurrence.localDate >= '2026-03-05')).toBe(
      true
    );
  });

  it('orders slots chronologically within the week regardless of input order', () => {
    const calendar = buildCampaignCalendar(
      input({
        weekCount: 2,
        slots: [
          { weekday: 5, timeLocal: '17:00' },
          { weekday: 1, timeLocal: '06:00' },
          { weekday: 3, timeLocal: '12:00' },
        ],
      })
    );
    expect(calendar.occurrences.slice(0, 3).map((o) => o.weekday)).toEqual([1, 3, 5]);
    expect(calendar.occurrences.slice(0, 3).map((o) => o.localDate)).toEqual([
      '2026-03-02',
      '2026-03-04',
      '2026-03-06',
    ]);
  });

  it('holds the weekday and wall-clock time across a daylight-saving change', () => {
    // 2026-03-08 is the US spring-forward Sunday; this campaign spans it.
    const calendar = buildCampaignCalendar(
      input({ weekCount: 12, startDate: '2026-03-02', slots: [{ weekday: 1, timeLocal: '18:00' }] })
    );
    expect(calendar.occurrences).toHaveLength(12);
    for (const occurrence of calendar.occurrences) {
      expect(weekdayOf(occurrence.localDate)).toBe(1);
      expect(occurrence.localTime).toBe('18:00');
    }
    expect(calendar.occurrences[11].localDate).toBe('2026-05-18');
  });

  it('builds the largest campaign the product allows', () => {
    const calendar = buildCampaignCalendar(
      input({
        weekCount: 12,
        slots: [
          { weekday: 1, timeLocal: '06:00' },
          { weekday: 2, timeLocal: '06:00' },
          { weekday: 3, timeLocal: '06:00' },
          { weekday: 4, timeLocal: '06:00' },
          { weekday: 5, timeLocal: '06:00' },
        ],
      })
    );
    expect(calendar.totalMissions).toBe(60);
    expect(new Set(calendar.occurrences.map((o) => o.localDate)).size).toBe(60);
  });

  it('rejects a length that is not an offered campaign duration', () => {
    expect(() => buildCampaignCalendar(input({ weekCount: 3 as never }))).toThrow(
      CampaignValidationError
    );
  });

  it('rejects a malformed start date', () => {
    expect(() => buildCampaignCalendar(input({ startDate: '2026-02-30' }))).toThrow(
      CampaignValidationError
    );
  });

  it('rejects too few or too many missions a week', () => {
    expect(() => buildCampaignCalendar(input({ slots: [] }))).toThrow(CampaignValidationError);
    expect(() =>
      buildCampaignCalendar(
        input({
          slots: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, timeLocal: '06:00' })),
        })
      )
    ).toThrow(CampaignValidationError);
  });

  it('rejects two missions on the same weekday', () => {
    expect(() =>
      buildCampaignCalendar(
        input({
          slots: [
            { weekday: 1, timeLocal: '06:00' },
            { weekday: 1, timeLocal: '18:00' },
          ],
        })
      )
    ).toThrow(CampaignValidationError);
  });

  it('rejects an out-of-range weekday or a malformed time', () => {
    expect(() =>
      buildCampaignCalendar(input({ slots: [{ weekday: 7, timeLocal: '06:00' }] }))
    ).toThrow(CampaignValidationError);
    expect(() =>
      buildCampaignCalendar(input({ slots: [{ weekday: 1, timeLocal: '6:00' }] }))
    ).toThrow(CampaignValidationError);
  });

  it('does not mutate the caller slots array', () => {
    const slots = [
      { weekday: 5, timeLocal: '17:00' },
      { weekday: 1, timeLocal: '06:00' },
    ];
    buildCampaignCalendar(input({ slots }));
    expect(slots.map((slot) => slot.weekday)).toEqual([5, 1]);
  });
});
