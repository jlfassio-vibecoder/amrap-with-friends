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

export type ClassificationRank =
  | 'unclassified'
  | 'civilian'
  | 'operator'
  | 'special_ops';

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
  chronicWeeklyLoad28d: number;
  consecutiveHighIntensityDays: number;
};

export interface HUDTelemetryPayload {
  weekMinutes: number;
  weekPviAverage: number | null;
  weekEndsAt: string;
  lastLockedAt: string | null;
  attrition: boolean[];
  domainMinutes30d: HudDomainMinutes;
  classification: HudClassification;
  overtraining: HudOvertraining;
}
