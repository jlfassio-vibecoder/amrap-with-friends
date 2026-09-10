import type { MissionChainItem } from '@/lib/api/missionChain';
import { chainTotalSec } from '@/lib/mission/chainRest';

/** Waiting-room line while rest is armed between chained missions. */
export function formatChainRestBanner(chainPosition: number, chainRemaining: number): string {
  const n = chainPosition + 1;
  const total = chainPosition + 1 + chainRemaining;
  return `Rest — mission ${n} of ${total} starts when the host is ready.`;
}

/** One-line session plan for mission 1 / joiners when a chain is saved. */
export function formatChainPlanSummary(items: MissionChainItem[]): string | null {
  if (items.length < 2) {
    return null;
  }

  const totalSec = chainTotalSec(
    items.map((item) => ({
      durationMinutes: item.durationMinutes,
      intensityTier: item.intensityTier,
    }))
  );
  const aboutMinutes = Math.max(1, Math.round(totalSec / 60));
  return `${items.length} missions · about ${aboutMinutes} min`;
}

export function chainHasUnstartedItems(items: MissionChainItem[]): boolean {
  return items.some((item) => item.startedMissionId === null);
}

/** Rest line for the waiting room of a mid-chain mission, or null on mission 1 / unknown. */
export function chainRestBannerForMission(
  items: MissionChainItem[],
  missionId: string
): string | null {
  const current = items.find((item) => item.startedMissionId === missionId);
  if (!current || current.position === 0) {
    return null;
  }
  const remaining = items.filter((item) => item.startedMissionId === null).length;
  return formatChainRestBanner(current.position, remaining);
}

/** Plan summary only on mission 1 of a saved chain. */
export function chainPlanSummaryForMission(
  items: MissionChainItem[],
  missionId: string
): string | null {
  const current = items.find((item) => item.startedMissionId === missionId);
  if (!current || current.position !== 0) {
    return null;
  }
  return formatChainPlanSummary(items);
}
