import { AttritionGrid } from '@/components/hud/AttritionGrid';
import { ScoreTrendChart } from '@/components/hud/ScoreTrendChart';
import type { ScoreTrendWeek } from '@/lib/hud/scoreTrend';
import type { HudHistoryWeek } from '@/lib/hud/types';

interface WeekHistoryTrendCardProps {
  trendWeeks: ScoreTrendWeek[];
  attrition: boolean[];
  weekEndsAt: string;
  historyWeeks: HudHistoryWeek[];
  selectedIndex: number | null;
  onSelectWeek?: (index: number) => void;
}

/**
 * Score trend + Attrition as one composition: compact chart context above the
 * week picker that drives Week detail.
 */
export function WeekHistoryTrendCard({
  trendWeeks,
  attrition,
  weekEndsAt,
  historyWeeks,
  selectedIndex,
  onSelectWeek,
}: WeekHistoryTrendCardProps) {
  return (
    <section className="card space-y-4 p-4" aria-label="Week history trend">
      <ScoreTrendChart weeks={trendWeeks} selectedIndex={selectedIndex} embedded />
      <div className="border-t border-divider pt-4">
        <AttritionGrid
          attrition={attrition}
          weekEndsAt={weekEndsAt}
          weeks={historyWeeks}
          selectedIndex={selectedIndex}
          onSelect={onSelectWeek}
          embedded
        />
      </div>
    </section>
  );
}
