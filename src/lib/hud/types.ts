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

export interface HUDTelemetryPayload {
  weekMinutes: number;
  weekPviAverage: number | null;
  weekEndsAt: string;
  lastLockedAt: string | null;
  attrition: boolean[];
  domainMinutes30d: HudDomainMinutes;
}
