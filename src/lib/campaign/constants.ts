import type { CampaignWeekCount } from './types';

export const CAMPAIGN_WEEK_COUNTS: CampaignWeekCount[] = [2, 4, 6, 8, 12];

export const MIN_MISSIONS_PER_WEEK = 1;
export const MAX_MISSIONS_PER_WEEK = 5;

/** 12 weeks x 5 missions — the largest calendar a host can build. */
export const MAX_CAMPAIGN_OCCURRENCES = 60;

/**
 * Below this length a campaign is too short to spend a mission going easy —
 * a 6-week campaign that deloads twice has given up a sixth of its training.
 */
export const MIN_WEEKS_FOR_DELOAD = 8;

/** The most tests any campaign length schedules — see TEST_WEEKS. */
export const MAX_CAMPAIGN_TESTS = 3;
