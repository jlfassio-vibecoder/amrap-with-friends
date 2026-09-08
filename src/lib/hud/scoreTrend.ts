import type { MyMissionEntry } from '@/lib/api/myMissions';

export interface ScoreTrendWeek {
  /** Monday 00:00 local time for this bucket, ISO string. */
  weekStart: string;
  /** Sum of finalScore across locked missions dated in this week. */
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

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** `YYYY-MM-DD` in local time — never `toISOString()`, which shifts to UTC and can land on the wrong local day. */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Midnight local time on the Monday of `date`'s week — the same "since
 * Monday" week `WeeklyBaselineBar` already uses, kept local so a mission
 * logged at 11pm Sunday and one at 1am Monday land in different weeks by the
 * athlete's own clock, not the server's.
 */
function startOfLocalWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/**
 * Buckets locked missions into `weekCount` consecutive local weeks ending at
 * `now`'s week, oldest first — the shape a bar chart reads left to right as
 * time moving forward. Weeks with no missions still appear, at zero: a gap is
 * exactly as real a data point as a bar, and the athlete's attrition grid
 * elsewhere on this HUD makes the same choice for the same reason.
 *
 * Only missions with a locked `finalScore` count, matching every other score
 * display on this HUD (`formatMyMissionScoreDisplay`, the My missions list) —
 * an in-progress or abandoned mission has no final score to add.
 */
export function buildScoreTrend(
  entries: readonly MyMissionEntry[],
  weekCount: number,
  now: Date = new Date()
): ScoreTrendWeek[] {
  const currentWeekStart = startOfLocalWeek(now);

  const buckets = new Map<
    string,
    { weekStart: Date; totalScore: number; totalMinutes: number; missionCount: number }
  >();

  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    buckets.set(localDateKey(weekStart), {
      weekStart,
      totalScore: 0,
      totalMinutes: 0,
      missionCount: 0,
    });
  }

  for (const entry of entries) {
    if (entry.finalScore === null) {
      continue;
    }
    const when = new Date(entry.scheduledAt ?? entry.createdAt);
    if (Number.isNaN(when.getTime())) {
      continue;
    }
    const bucket = buckets.get(localDateKey(startOfLocalWeek(when)));
    if (!bucket) {
      continue; // Outside the window this trend covers.
    }
    bucket.totalScore += entry.finalScore;
    bucket.totalMinutes += entry.durationMinutes;
    bucket.missionCount += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((bucket) => ({
      weekStart: bucket.weekStart.toISOString(),
      totalScore: bucket.totalScore,
      totalMinutes: bucket.totalMinutes,
      missionCount: bucket.missionCount,
      scorePerMinute:
        bucket.totalMinutes > 0
          ? Math.round((bucket.totalScore / bucket.totalMinutes) * 10) / 10
          : null,
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
