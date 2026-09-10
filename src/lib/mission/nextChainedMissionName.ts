import type { MissionChainItem } from '@/lib/api/missionChain';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';

/**
 * Label for the next queued chain mission, or null when there is nothing queued
 * (empty chain, single leftover row, or every item already started).
 */
export function nextChainedMissionName(items: MissionChainItem[]): string | null {
  if (items.length < 2) {
    return null;
  }

  const next = items.find((item) => item.startedMissionId === null);
  if (!next) {
    return null;
  }

  return resolveWorkoutTitle(next.templateId);
}
