import { ActivityWindowSummaryCard } from '@/components/hud/ActivityWindowSummaryCard';
import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';
import { summarizePhysicalActivityWindow } from '@/lib/hud/activityWindowSummary';

interface OutsideActivitySummaryCardProps {
  entries: PhysicalActivityEntry[];
}

export function OutsideActivitySummaryCard({ entries }: OutsideActivitySummaryCardProps) {
  const summary = summarizePhysicalActivityWindow(entries);

  return (
    <ActivityWindowSummaryCard
      title="Outside Activity — Last 7 Days"
      ariaLabel="Outside activity summary"
      missionCount={summary.missionCount}
      totalMinutes={summary.totalMinutes}
      averageIntensity={summary.averageIntensity}
      footer="Does not count toward weekly classification minutes."
    />
  );
}
