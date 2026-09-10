import type { HudHistoryWeek } from '@/lib/hud/types';

export interface ScoreTrendWeek {
  /** Monday 00:00 local time for this bucket, as an instant. */
  weekStart: string;
  /** Sum of finalScore across the week's locked missions. */
  totalScore: number;
  /** Sum of durationMinutes across those same missions. */
  totalMinutes: number;
  missionCount: number;
  /** totalScore / totalMinutes, one decimal. Null when no minutes were logged. */
  scorePerMinute: number | null;
}

export interface ScoreTrendSummary {
  currentWeek: ScoreTrendWeek;
  previousWeek: ScoreTrendWeek | null;
  /** Percent change in totalScore vs. the previous week. Null with no prior week, or a zero prior score (a ratio against zero is not a percent). */
  scoreChangePercent: number | null;
}

/**
 * The chart's view of the weeks `hud_telemetry` already returns.
 *
 * This used to bucket `my_missions()` rows client-side on
 * `scheduledAt ?? createdAt`, which put a mission scheduled in one week but
 * finished in the next into a different week than the Weekly baseline card —
 * the drift Bugbot caught on the score-trend PR. The server now sends the
 * weeks it has always computed, bucketed on lock time, so both cards read the
 * same buckets by construction and there is no date arithmetic left here to
 * disagree with.
 */
export function scoreTrendFromHistory(weeks: readonly HudHistoryWeek[]): ScoreTrendWeek[] {
  return weeks.map((week) => ({
    weekStart: week.weekStart,
    totalScore: week.score,
    totalMinutes: week.minutes,
    missionCount: week.missionCount,
    scorePerMinute: week.minutes > 0 ? Math.round((week.score / week.minutes) * 10) / 10 : null,
  }));
}

/** The most recent week plus its change from the one before, for the headline figure. */
export function summarizeScoreTrend(weeks: readonly ScoreTrendWeek[]): ScoreTrendSummary | null {
  if (weeks.length === 0) {
    return null;
  }

  const currentWeek = weeks[weeks.length - 1];
  const previousWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;

  const scoreChangePercent =
    previousWeek !== null && previousWeek.totalScore > 0
      ? Math.round(
          ((currentWeek.totalScore - previousWeek.totalScore) / previousWeek.totalScore) * 1000
        ) / 10
      : null;

  return { currentWeek, previousWeek, scoreChangePercent };
}

/**
 * True when this week and last week logged nearly the same minutes but
 * scored meaningfully differently — the exact thing final score exists to
 * catch that a minutes-only view cannot: the same time on the clock spent at
 * a different intensity. Worth naming outright rather than leaving the
 * athlete to notice it themselves by eyeballing two numbers in a table.
 */
export function isIntensityShiftWeek(
  current: ScoreTrendWeek,
  previous: ScoreTrendWeek | null
): boolean {
  if (previous === null || previous.totalMinutes === 0 || current.totalMinutes === 0) {
    return false;
  }

  const minutesChange =
    Math.abs(current.totalMinutes - previous.totalMinutes) / previous.totalMinutes;
  if (minutesChange > 0.1) {
    return false; // Minutes moved too — not an apples-to-apples week.
  }

  if (previous.totalScore === 0) {
    return false;
  }
  const scoreChange = Math.abs(current.totalScore - previous.totalScore) / previous.totalScore;
  return scoreChange >= 0.05;
}

/**
 * The smallest "nice" number (1/2/5 × a power of ten) at or above `value` —
 * a y-axis ceiling that lands on round gridlines (0 / 500 / 1,000, never
 * 0 / 437 / 874) regardless of what an athlete's actual weekly totals are.
 */
export function niceCeiling(value: number): number {
  if (value <= 0) {
    return 100;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
