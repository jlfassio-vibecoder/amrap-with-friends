export const WEEKLY_BASELINE_MINUTES = 150;

export interface HUDTelemetryPayload {
  weekMinutes: number;
  weekPviAverage: number | null;
  weekEndsAt: string;
}
