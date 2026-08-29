import type { CampaignWeekCount } from './types';

export const CAMPAIGN_WEEK_COUNTS: CampaignWeekCount[] = [2, 4, 6, 8, 12];

export const MIN_SESSIONS_PER_WEEK = 1;
export const MAX_SESSIONS_PER_WEEK = 5;

/** 12 weeks x 5 sessions — the largest calendar a host can build. */
export const MAX_CAMPAIGN_OCCURRENCES = 60;
