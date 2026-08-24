export const WEEKLY_BASELINE_MINUTES = 150;

export type HudDailyStatus = 'active' | 'dormant' | 'detraining' | 'never';

export interface HUDTelemetryPayload {
  weekMinutes: number;
  weekPviAverage: number | null;
  weekEndsAt: string;
  lastLockedAt: string | null;
  attrition: boolean[];
}
