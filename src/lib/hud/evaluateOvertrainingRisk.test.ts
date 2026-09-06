import { describe, it, expect } from 'vitest';
import {
  BASELINE_WINDOW_DAYS,
  evaluateOvertrainingRisk,
  MIN_CHRONIC_WEEKLY_LOAD_FOR_RATIO,
} from './evaluateOvertrainingRisk';

/** A chronic baseline comfortably above the floor, so the ratio is evaluated. */
const SETTLED = 300;

describe('evaluateOvertrainingRisk', () => {
  it('returns null acwr and normal risk when there is no data', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 0,
        chronicWeeklyLoad28d: 0,
        consecutiveHighIntensityDays: 0,
      })
    ).toMatchObject({ acwr: null, riskLevel: 'normal', guidance: [] });
  });

  it('returns null acwr when chronic baseline is insufficient', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 500,
        chronicWeeklyLoad28d: 0,
        consecutiveHighIntensityDays: 0,
      })
    ).toMatchObject({ acwr: null, riskLevel: 'normal', guidance: [] });
  });

  it('returns null acwr when all logged load falls inside the acute window', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: 60,
        chronicWeeklyLoad28d: 15,
        consecutiveHighIntensityDays: 0,
      })
    ).toMatchObject({ acwr: null, riskLevel: 'normal', guidance: [] });
  });

  it('is normal for a balanced acute:chronic load', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: SETTLED,
        chronicWeeklyLoad28d: SETTLED,
        consecutiveHighIntensityDays: 0,
      })
    ).toMatchObject({ acwr: 1, riskLevel: 'normal', guidance: [] });
  });
});

describe('the load floor', () => {
  it('does not call a light week overtraining, however sharp the ratio', () => {
    // The reported case: ~70 minutes across 7 days against a near-empty month.
    // The ratio is real, the risk claim is not.
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 190,
      chronicWeeklyLoad28d: 85,
      consecutiveHighIntensityDays: 0,
    });

    expect(result.acwr).toBe(2.24);
    expect(result.riskLevel).toBe('building');
    expect(result.guidance[0].headline).toMatch(/not overtraining/i);
  });

  it('tells a building athlete to add training, never to back off', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 190,
      chronicWeeklyLoad28d: 85,
      consecutiveHighIntensityDays: 0,
    });

    expect(result.guidance[0].doThis).toMatch(/keep training/i);
    expect(result.guidance[0].doThis).not.toMatch(/scale back|ease|rest day/i);
  });

  it('evaluates the ratio once the baseline reaches the floor', () => {
    const atFloor = evaluateOvertrainingRisk({
      acuteLoad7d: 600,
      chronicWeeklyLoad28d: MIN_CHRONIC_WEEKLY_LOAD_FOR_RATIO,
      consecutiveHighIntensityDays: 0,
    });
    const justUnder = evaluateOvertrainingRisk({
      acuteLoad7d: 600,
      chronicWeeklyLoad28d: MIN_CHRONIC_WEEKLY_LOAD_FOR_RATIO - 1,
      consecutiveHighIntensityDays: 0,
    });

    expect(atFloor.riskLevel).toBe('high');
    expect(justUnder.riskLevel).toBe('building');
  });

  it('still reports the ratio while building, rather than hiding it', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 190,
      chronicWeeklyLoad28d: 85,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.acwr).not.toBeNull();
  });
});

describe('thresholds above the floor', () => {
  it('is normal exactly at the elevated threshold', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: SETTLED * 1.5,
        chronicWeeklyLoad28d: SETTLED,
        consecutiveHighIntensityDays: 0,
      })
    ).toMatchObject({ acwr: 1.5, riskLevel: 'normal', guidance: [] });
  });

  it('is elevated just over the elevated threshold', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 1.53,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.riskLevel).toBe('elevated');
    expect(result.guidance).toHaveLength(1);
  });

  it('is elevated (not high) exactly at the high threshold', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.acwr).toBe(2);
    expect(result.riskLevel).toBe('elevated');
  });

  it('is high just over the high threshold', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2.03,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.riskLevel).toBe('high');
    expect(result.guidance).toHaveLength(1);
  });

  it('compares the ratio the athlete is shown, not a hidden one', () => {
    // The ratio is rounded to two decimals before the thresholds are applied, so
    // a displayed 1.50 is never described as being over 1.5. Worth pinning:
    // a card that says 1.50 next to "past 1.5" would read as a bug.
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 1.5 + 1,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.acwr).toBe(1.5);
    expect(result.riskLevel).toBe('normal');
  });

  it('states the comparison as a multiple of a normal week, not a ratio name', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2.2,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
    });
    expect(result.guidance[0].because).toContain('2.2×');
  });
});

describe('consecutive high-intensity days', () => {
  it('is normal at 4 days', () => {
    expect(
      evaluateOvertrainingRisk({
        acuteLoad7d: SETTLED,
        chronicWeeklyLoad28d: SETTLED,
        consecutiveHighIntensityDays: 4,
      })
    ).toMatchObject({ acwr: 1, riskLevel: 'normal', guidance: [] });
  });

  it('fires alone at 5 days', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 5,
    });
    expect(result.riskLevel).toBe('elevated');
    expect(result.guidance).toHaveLength(1);
    expect(result.guidance[0].headline).toBe('5 hard days in a row.');
  });

  it('escalates a building athlete who is stacking hard days', () => {
    // Low volume does not excuse five hard days back to back — this signal is
    // about recovery between efforts, not weekly totals.
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: 190,
      chronicWeeklyLoad28d: 85,
      consecutiveHighIntensityDays: 5,
    });
    expect(result.riskLevel).toBe('elevated');
    expect(result.guidance).toHaveLength(2);
  });

  it('combines with a high ratio without downgrading it', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2.5,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 6,
    });
    expect(result.riskLevel).toBe('high');
    expect(result.guidance).toHaveLength(2);
  });
});

describe('guidance copy', () => {
  const everyState = [
    { acuteLoad7d: 190, chronicWeeklyLoad28d: 85, consecutiveHighIntensityDays: 0 },
    { acuteLoad7d: SETTLED * 1.6, chronicWeeklyLoad28d: SETTLED, consecutiveHighIntensityDays: 0 },
    { acuteLoad7d: SETTLED * 2.5, chronicWeeklyLoad28d: SETTLED, consecutiveHighIntensityDays: 0 },
    { acuteLoad7d: SETTLED, chronicWeeklyLoad28d: SETTLED, consecutiveHighIntensityDays: 5 },
  ];

  it('never prescribes a rest day', () => {
    // The whole point of the rewrite: an athlete who stops training drops the
    // baseline that caused the warning, so inactivity is the wrong answer.
    for (const input of everyState) {
      for (const item of evaluateOvertrainingRisk(input).guidance) {
        expect(item.doThis).not.toMatch(/rest day|day off|take a day/i);
      }
    }
  });

  it('always names a concrete next mission', () => {
    for (const input of everyState) {
      for (const item of evaluateOvertrainingRisk(input).guidance) {
        expect(item.doThis).toMatch(/intensity \d/i);
      }
    }
  });

  it('always says what happened and why before what to do', () => {
    for (const input of everyState) {
      for (const item of evaluateOvertrainingRisk(input).guidance) {
        expect(item.headline.length).toBeGreaterThan(0);
        expect(item.because.length).toBeGreaterThan(0);
        expect(item.doThis.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the first four weeks', () => {
  const settled = { acuteLoad7d: SETTLED * 2.5, chronicWeeklyLoad28d: SETTLED };

  it('treats a full window as settled', () => {
    const result = evaluateOvertrainingRisk({
      ...settled,
      consecutiveHighIntensityDays: 0,
      observedDays: BASELINE_WINDOW_DAYS,
    });
    expect(result.isLearningBaseline).toBe(false);
    expect(result.riskLevel).toBe('high');
    expect(result.guidance).toHaveLength(1);
  });

  it('never escalates to high risk while the baseline is still forming', () => {
    // Nine days of history: one hard session moves the average enough to swing
    // the ratio on its own, so under-warning is the safe direction.
    const result = evaluateOvertrainingRisk({
      ...settled,
      consecutiveHighIntensityDays: 0,
      observedDays: 9,
    });
    expect(result.isLearningBaseline).toBe(true);
    expect(result.riskLevel).toBe('elevated');
  });

  it('says how much history is behind the numbers', () => {
    const result = evaluateOvertrainingRisk({
      ...settled,
      consecutiveHighIntensityDays: 0,
      observedDays: 9,
    });
    const learning = result.guidance.at(-1)!;
    expect(learning.headline).toMatch(/still learning/i);
    expect(learning.because).toContain('9 days');
    expect(learning.doThis).toMatch(/train the way you intend/i);
  });

  it('still flags consecutive hard days, which need no baseline', () => {
    const result = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 5,
      observedDays: 5,
    });
    expect(result.riskLevel).toBe('elevated');
    expect(result.guidance.some((item) => item.headline.includes('hard days in a row'))).toBe(true);
  });

  it('assumes a settled baseline when the field is absent', () => {
    // A client running ahead of the migration must not silently mark every
    // athlete as still learning.
    const result = evaluateOvertrainingRisk({ ...settled, consecutiveHighIntensityDays: 0 });
    expect(result.isLearningBaseline).toBe(false);
    expect(result.observedDays).toBe(BASELINE_WINDOW_DAYS);
  });
});

describe('reading the numbers', () => {
  it('drops the three-week explanation when there are not three weeks', () => {
    const learning = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2.5,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
      observedDays: 9,
    });
    const settled = evaluateOvertrainingRisk({
      acuteLoad7d: SETTLED * 2.5,
      chronicWeeklyLoad28d: SETTLED,
      consecutiveHighIntensityDays: 0,
      observedDays: BASELINE_WINDOW_DAYS,
    });

    expect(learning.guidance[0].because).not.toMatch(/three weeks before/);
    expect(settled.guidance[0].because).toMatch(/three weeks before/);
  });

  it('never names the ratio in athlete-facing copy', () => {
    // "ACWR" and "acute:chronic" are bookkeeping terms. The card says what the
    // number means instead: this week against a normal week.
    for (const observedDays of [9, BASELINE_WINDOW_DAYS]) {
      const result = evaluateOvertrainingRisk({
        acuteLoad7d: SETTLED * 2.5,
        chronicWeeklyLoad28d: SETTLED,
        consecutiveHighIntensityDays: 5,
        observedDays,
      });
      for (const item of result.guidance) {
        expect(`${item.headline} ${item.because} ${item.doThis}`).not.toMatch(
          /acwr|acute[:-]chronic/i
        );
      }
    }
  });
});
