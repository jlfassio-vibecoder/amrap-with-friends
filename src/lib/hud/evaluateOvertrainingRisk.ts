export interface OvertrainingInput {
  acuteLoad7d: number;
  chronicWeeklyLoad28d: number;
  consecutiveHighIntensityDays: number;
}

export type OvertrainingRiskLevel = 'normal' | 'elevated' | 'high';

export interface OvertrainingResult {
  acwr: number | null;
  riskLevel: OvertrainingRiskLevel;
  warnings: string[];
}

const ACWR_ELEVATED_THRESHOLD = 1.5;
const ACWR_HIGH_THRESHOLD = 2.0;
const REST_DAY_CONSECUTIVE_THRESHOLD = 5;

const ACWR_ELEVATED_WARNING =
  'System Warning: Acute load is climbing faster than your chronic baseline. Elevated injury risk — consider easing intensity.';
const ACWR_HIGH_WARNING =
  'System Warning: Acute:chronic load ratio is in the high-risk zone. Scale back intensity or take a rest day.';
const REST_DAY_WARNING =
  'System Warning: 5+ consecutive high-intensity days detected. Take a rest day to avoid CNS fatigue.';

export function evaluateOvertrainingRisk(input: OvertrainingInput): OvertrainingResult {
  // chronicWeeklyLoad28d is a 4-week average that already includes the
  // trailing 7 days, so on its own it can't tell a real baseline apart
  // from "all of this athlete's history is this week." Require some load
  // to exist outside the acute window too — otherwise a single mission
  // with no training before it can look like a huge acute:chronic spike.
  const totalLoad28d = input.chronicWeeklyLoad28d * 4;
  const priorPeriodLoad = totalLoad28d - input.acuteLoad7d;
  const hasBaseline = input.chronicWeeklyLoad28d > 0 && priorPeriodLoad > 0;

  const acwr = hasBaseline
    ? Math.round((input.acuteLoad7d / input.chronicWeeklyLoad28d) * 100) / 100
    : null;

  const warnings: string[] = [];

  let acwrRisk: OvertrainingRiskLevel = 'normal';
  if (acwr !== null && acwr > ACWR_HIGH_THRESHOLD) {
    acwrRisk = 'high';
    warnings.push(ACWR_HIGH_WARNING);
  } else if (acwr !== null && acwr > ACWR_ELEVATED_THRESHOLD) {
    acwrRisk = 'elevated';
    warnings.push(ACWR_ELEVATED_WARNING);
  }

  const restDayTriggered = input.consecutiveHighIntensityDays >= REST_DAY_CONSECUTIVE_THRESHOLD;
  if (restDayTriggered) {
    warnings.push(REST_DAY_WARNING);
  }

  let riskLevel: OvertrainingRiskLevel = acwrRisk;
  if (restDayTriggered && riskLevel === 'normal') {
    riskLevel = 'elevated';
  }

  return { acwr, riskLevel, warnings };
}
