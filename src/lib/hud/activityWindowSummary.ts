import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';

export const ACTIVITY_WINDOW_DAYS = 7;

export type ActivityWindowSummary = {
  missionCount: number;
  totalMinutes: number;
  averageIntensity: number | null;
};

export function summarizePhysicalActivityWindow(
  entries: PhysicalActivityEntry[],
  nowMs: number = Date.now(),
  windowDays: number = ACTIVITY_WINDOW_DAYS
): ActivityWindowSummary {
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const recent = entries.filter((entry) => new Date(entry.occurredAt).getTime() >= cutoff);
  const missionCount = recent.length;
  const totalMinutes = recent.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const averageIntensity =
    missionCount > 0
      ? recent.reduce((sum, entry) => sum + entry.intensityTier, 0) / missionCount
      : null;

  return { missionCount, totalMinutes, averageIntensity };
}

export type ActivityAttribution = {
  totalMissions: number;
  totalMinutes: number;
  inAppMinutes: number;
  outsideMinutes: number;
  inAppPercent: number;
  outsidePercent: number;
};

export function buildActivityAttribution(input: {
  inAppMissions: number;
  outsideMissions: number;
  inAppMinutes: number;
  outsideMinutes: number;
}): ActivityAttribution {
  const inAppMinutes = Math.max(0, input.inAppMinutes);
  const outsideMinutes = Math.max(0, input.outsideMinutes);
  const totalMinutes = inAppMinutes + outsideMinutes;
  const totalMissions = Math.max(0, input.inAppMissions) + Math.max(0, input.outsideMissions);

  if (totalMinutes === 0) {
    return {
      totalMissions,
      totalMinutes: 0,
      inAppMinutes,
      outsideMinutes,
      inAppPercent: 0,
      outsidePercent: 0,
    };
  }

  const inAppPercent = (inAppMinutes / totalMinutes) * 100;
  const outsidePercent = (outsideMinutes / totalMinutes) * 100;

  return {
    totalMissions,
    totalMinutes,
    inAppMinutes,
    outsideMinutes,
    inAppPercent,
    outsidePercent,
  };
}
