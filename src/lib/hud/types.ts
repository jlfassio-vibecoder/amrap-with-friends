/** Alpha-male Civilian volume; live HUD uses scaled `quotas.civilianMinutes`. */
export const WEEKLY_BASELINE_MINUTES = 150;

export type HudDailyStatus = 'active' | 'dormant' | 'detraining' | 'never';

export type HudCoreDomain = 5 | 10 | 15 | 20;

export type HudDomainMinutes = {
  5: number;
  10: number;
  15: number;
  20: number;
  other: number;
};

export type ClassificationRank = 'unclassified' | 'civilian' | 'operator' | 'special_ops';

export type ClassificationProgress = {
  weekMinutes: number;
  intensity3PlusCount: number;
  intensity4PlusCount: number;
  marathon20Count: number;
};

export type HudClassification = {
  current: ClassificationRank;
  previous: ClassificationRank;
  progress: ClassificationProgress;
};

export type HudOvertraining = {
  acuteLoad7d: number;
  /** 28-day load divided by the weeks of history the account actually has. */
  chronicWeeklyLoad28d: number;
  consecutiveHighIntensityDays: number;
  /** Minutes trained in the last 7 days, across missions and logged activity. */
  acuteMinutes7d: number;
  /** The athlete's typical week in minutes, on the same observed window. */
  chronicWeeklyMinutes28d: number;
  /** Days of history this account could have, capped at 28. */
  observedDays: number;
};

/** Rolling 7-day locked-mission rollup for the In-App Activity HUD card. */
export type HudActivity7d = {
  missionCount: number;
  minutes: number;
  avgIntensity: number | null;
};

/** One locked mission's pacing spread inside this ISO week. */
export type HudWeekPviMission = {
  missionId: string;
  pvi: number;
  durationMinutes: number;
  templateId: string | null;
  lockedAt: string;
};

/** A mission inside a history week — `HudWeekPviMission` plus what it scored. */
export type HudWeekMission = HudWeekPviMission & {
  finalScore: number | null;
};

/**
 * One of the 12 local weeks `hud_telemetry` walks, kept whole rather than
 * reduced to a single bit. `weeks[0]` is the oldest, `weeks[11]` the current
 * week — the attrition strip reverses that for display (newest first).
 */
export type HudHistoryWeek = {
  /** Monday 00:00 local time for this week, as an instant. */
  weekStart: string;
  minutes: number;
  /** Minutes met this athlete's Civilian quota — the bit the attrition grid draws. */
  compliant: boolean;
  missionCount: number;
  /** Accumulated final score across the week's locked missions. */
  score: number;
  pviAverage: number | null;
  missions: HudWeekMission[];
};

export interface HUDTelemetryPayload {
  weekMinutes: number;
  weekPviAverage: number | null;
  /** Missions that contributed to `weekPviAverage`, newest lock first. */
  weekPviMissions: HudWeekPviMission[];
  weekEndsAt: string;
  lastLockedAt: string | null;
  attrition: boolean[];
  /** Empty when the server predates the week-history migration; the HUD degrades to the read-only grid. */
  weeks: HudHistoryWeek[];
  domainMinutes30d: HudDomainMinutes;
  classification: HudClassification;
  activity7d: HudActivity7d;
  overtraining: HudOvertraining;
}
