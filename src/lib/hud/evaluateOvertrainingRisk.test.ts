import { describe, it, expect } from 'vitest';
import { evaluateOvertrainingRisk } from './evaluateOvertrainingRisk';

describe('evaluateOvertrainingRisk', () => {
  it('returns null acwr and normal risk when there is no data', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 0,
        chronicWeeklyLoad28d: 0,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({ acwr: null, riskLevel: 'normal', warnings: [] });
  });

  it('returns null acwr when chronic baseline is insufficient', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 500,
        chronicWeeklyLoad28d: 0,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({ acwr: null, riskLevel: 'normal', warnings: [] });
  });

  it('returns null acwr when all logged load falls inside the acute window (no real baseline yet)', () => {
    // A single 30-minute moderate (tier 2) session, just logged, with
    // nothing before it: acuteLoad7d and the 28-day total are identical,
    // so there is no prior period to compare against.
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 60,
        chronicWeeklyLoad28d: 15,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({ acwr: null, riskLevel: 'normal', warnings: [] });
  });

  it('flags a real spike even when the prior baseline is small', () => {
    // Prior 21 days had a small amount of load (5), then a big acute week (500).
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 500,
      chronicWeeklyLoad28d: (5 + 500) / 4,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.acwr).not.toBeNull();
    expect(result.riskLevel).toBe('high');
  });

  it('is normal for a balanced acute:chronic load', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 60,
        chronicWeeklyLoad28d: 60,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({ acwr: 1, riskLevel: 'normal', warnings: [] });
  });

  it('is normal exactly at the elevated threshold', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 90,
        chronicWeeklyLoad28d: 60,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({ acwr: 1.5, riskLevel: 'normal', warnings: [] });
  });

  it('is elevated just over the elevated threshold', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 91,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.riskLevel).toBe('elevated');
    expect(result.acwr).toBeCloseTo(1.517, 2);
    expect(result.warnings).toHaveLength(1);
  });

  it('is elevated (not high) exactly at the high threshold', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 120,
        chronicWeeklyLoad28d: 60,
        consecutiveHighIntensityDays: 0,
      })
    ).toEqual({
      acwr: 2,
      riskLevel: 'elevated',
      warnings: [
        'System Warning: Acute load is climbing faster than your chronic baseline. Elevated injury risk — consider easing intensity.',
      ],
    });
  });

  it('is high just over the high threshold', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 121,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toHaveLength(1);
  });

  it('is normal at 4 consecutive high-intensity days', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 60,
        chronicWeeklyLoad28d: 60,
        consecutiveHighIntensityDays: 4,
      })
    ).toEqual({ acwr: 1, riskLevel: 'normal', warnings: [] });
  });

  it('flags the rest-day rule alone at 5 consecutive high-intensity days', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 60,
        chronicWeeklyLoad28d: 60,
        consecutiveHighIntensityDays: 5,
      })
    ).toEqual({
      acwr: 1,
      riskLevel: 'elevated',
      warnings: [
        'System Warning: 5+ consecutive high-intensity days detected. Take a rest day to avoid CNS fatigue.',
      ],
    });
  });

  it('combines both warnings when ACWR is high and the rest-day rule triggers', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 150,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 6,
    });
    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toHaveLength(2);
  });

  it('does not downgrade high risk when the rest-day rule also fires', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 200,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 5,
    });
    expect(result.riskLevel).toBe('high');
  });
});
