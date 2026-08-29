import { addCalendarDays, isCalendarDate, isLocalTime, weekdayOf } from './calendarDate';
import {
  CAMPAIGN_WEEK_COUNTS,
  MAX_SESSIONS_PER_WEEK,
  MIN_SESSIONS_PER_WEEK,
} from './constants';
import {
  CampaignValidationError,
  type CampaignCalendar,
  type CampaignOccurrence,
  type CampaignScheduleInput,
  type CampaignSlot,
} from './types';

function assertValidInput(input: CampaignScheduleInput): void {
  if (!CAMPAIGN_WEEK_COUNTS.includes(input.weekCount)) {
    throw new CampaignValidationError(
      `Campaign length must be one of ${CAMPAIGN_WEEK_COUNTS.join(', ')} weeks.`
    );
  }

  if (!isCalendarDate(input.startDate)) {
    throw new CampaignValidationError('Start date must be a calendar date (YYYY-MM-DD).');
  }

  const count = input.slots.length;
  if (count < MIN_SESSIONS_PER_WEEK || count > MAX_SESSIONS_PER_WEEK) {
    throw new CampaignValidationError(
      `A campaign needs ${MIN_SESSIONS_PER_WEEK} to ${MAX_SESSIONS_PER_WEEK} sessions a week.`
    );
  }

  const seen = new Set<number>();
  for (const slot of input.slots) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
      throw new CampaignValidationError('Each session day must be a weekday from 0 to 6.');
    }
    if (seen.has(slot.weekday)) {
      throw new CampaignValidationError('Each session must fall on a different day of the week.');
    }
    seen.add(slot.weekday);

    if (!isLocalTime(slot.timeLocal)) {
      throw new CampaignValidationError('Each session time must be a 24-hour time (HH:MM).');
    }
  }
}

/**
 * Offset in days from the campaign's start date to this slot's first
 * occurrence. Week 1 is the seven days beginning on `startDate`, so a slot
 * whose weekday falls earlier in the calendar week than the start date rolls
 * forward rather than landing before the campaign begins.
 */
function firstOffsetForSlot(slot: CampaignSlot, startWeekday: number): number {
  return (slot.weekday - startWeekday + 7) % 7;
}

/**
 * Expands a weekly pattern into the campaign's full calendar.
 *
 * Occurrences carry local dates and wall-clock times only. Resolving them to
 * absolute instants is the generator's job at session-creation time — a
 * campaign booked for 18:00 stays at 18:00 after the clocks change, which
 * persisting a computed `timestamptz` months ahead would not.
 */
export function buildCampaignCalendar(input: CampaignScheduleInput): CampaignCalendar {
  assertValidInput(input);

  const startWeekday = weekdayOf(input.startDate);
  const orderedSlots = [...input.slots].sort(
    (a, b) =>
      firstOffsetForSlot(a, startWeekday) - firstOffsetForSlot(b, startWeekday) ||
      a.timeLocal.localeCompare(b.timeLocal)
  );

  const occurrences: CampaignOccurrence[] = [];

  for (let week = 0; week < input.weekCount; week += 1) {
    orderedSlots.forEach((slot, slotIndex) => {
      const offset = week * 7 + firstOffsetForSlot(slot, startWeekday);
      occurrences.push({
        sequence: occurrences.length + 1,
        weekNumber: week + 1,
        slotNumber: slotIndex + 1,
        localDate: addCalendarDays(input.startDate, offset),
        localTime: slot.timeLocal,
        weekday: slot.weekday,
      });
    });
  }

  return {
    occurrences,
    sessionsPerWeek: orderedSlots.length,
    totalSessions: occurrences.length,
    startDate: input.startDate,
    endDate: occurrences[occurrences.length - 1].localDate,
  };
}
