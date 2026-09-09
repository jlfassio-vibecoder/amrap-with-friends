import { WeeklyVolumeTargetCard } from '@/components/hud/WeeklyVolumeTargetCard';
import { WEEKLY_BASELINE_MINUTES, type HudHistoryWeek } from '@/lib/hud/types';

interface WeeklyBaselineBarProps {
  weekMinutes: number;
  weekEndsAt: string;
  baselineMinutes?: number;
  /** Locked minutes from the previous local week, when history has one. */
  previousWeekMinutes?: number | null;
  /** Prior local week bucket — used to cut minutes by the same clock time last week. */
  previousWeek?: HudHistoryWeek | null;
}

export function WeeklyBaselineBar({
  weekMinutes,
  weekEndsAt,
  baselineMinutes = WEEKLY_BASELINE_MINUTES,
  previousWeekMinutes = null,
  previousWeek = null,
}: WeeklyBaselineBarProps) {
  return (
    <WeeklyVolumeTargetCard
      title="Weekly baseline · since Monday"
      ariaLabel="Weekly baseline"
      progressAriaLabel="Weekly minutes toward baseline"
      weekMinutes={weekMinutes}
      weekEndsAt={weekEndsAt}
      targetMinutes={baselineMinutes}
      previousWeekMinutes={previousWeekMinutes}
      previousWeek={previousWeek}
      shareNoun="baseline"
      paceHeading="Pace to baseline"
      targetNoun="baseline"
      testIdPrefix="weekly-baseline"
    />
  );
}
