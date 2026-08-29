import type { IntensityTier, TimeDomain, WorkoutCategory } from '@/data/workoutTemplates';

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignValidationError';
  }
}

/** Campaign lengths a host can pick. */
export type CampaignWeekCount = 2 | 4 | 6 | 8 | 12;

/**
 * One repeating slot in the weekly pattern. `weekday` is 0 (Sunday) to
 * 6 (Saturday), matching `Date.prototype.getUTCDay`. `timeLocal` is a 24-hour
 * wall-clock time in the campaign's timezone — never an instant, so the
 * schedule survives a daylight-saving boundary (see buildCampaignCalendar).
 */
export interface CampaignSlot {
  weekday: number;
  timeLocal: string;
}

export interface CampaignScheduleInput {
  weekCount: CampaignWeekCount;
  /** First day of week 1, as a local calendar date: 'YYYY-MM-DD'. */
  startDate: string;
  slots: CampaignSlot[];
}

/**
 * One planned session. Deliberately carries no absolute timestamp: the
 * generator resolves `localDate` + `localTime` against the campaign's timezone
 * when it creates the session, so a campaign spanning a DST change keeps its
 * wall-clock time.
 */
export interface CampaignOccurrence {
  /** 1-based position across the whole campaign. */
  sequence: number;
  /** 1-based week, 1..weekCount. */
  weekNumber: number;
  /** 1-based position within its week, in chronological order. */
  slotNumber: number;
  localDate: string;
  localTime: string;
  weekday: number;
}

export interface CampaignCalendar {
  occurrences: CampaignOccurrence[];
  sessionsPerWeek: number;
  totalSessions: number;
  startDate: string;
  /** Local date of the final session. */
  endDate: string;
}

/**
 * A (duration, category) pair the host wants the campaign drawn from. The
 * planner rotates across tracks so consecutive sessions vary the stimulus.
 */
export interface CampaignTrack {
  durationMinutes: TimeDomain;
  category: WorkoutCategory;
}

export interface PlannedCampaignOccurrence extends CampaignOccurrence {
  templateId: string;
  workoutName: string;
  durationMinutes: TimeDomain;
  category: WorkoutCategory;
  intensityTier: IntensityTier;
}
