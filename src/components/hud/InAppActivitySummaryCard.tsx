import { ActivityWindowSummaryCard } from '@/components/hud/ActivityWindowSummaryCard';
import type { HudActivity7d } from '@/lib/hud/types';

interface InAppActivitySummaryCardProps {
  activity7d: HudActivity7d;
}

export function InAppActivitySummaryCard({ activity7d }: InAppActivitySummaryCardProps) {
  return (
    <ActivityWindowSummaryCard
      title="In-App Activity — Last 7 Days"
      ariaLabel="In-app activity summary"
      missionCount={activity7d.missionCount}
      totalMinutes={activity7d.minutes}
      averageIntensity={activity7d.avgIntensity}
      footer="Counts toward activity."
    />
  );
}
