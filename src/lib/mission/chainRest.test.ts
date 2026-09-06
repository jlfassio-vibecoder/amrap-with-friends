import { describe, it, expect } from 'vitest';
import { TIME_DOMAINS } from '@/data/workoutTemplates';
import { allTimeCaps, capsForDomain } from '@/lib/timeDomains';
import {
  chainAdvisories,
  chainRestPlan,
  chainTotalSec,
  formatRestSec,
  MAX_REST_SEC,
  MIN_REST_SEC,
  restAfterMissionSec,
  type ChainMission,
} from '@/lib/mission/chainRest';

const mission = (durationMinutes: number, intensityTier?: number | null): ChainMission => ({
  durationMinutes,
  intensityTier,
});

describe('restAfterMissionSec', () => {
  it('rests by the domain just run, not the exact minute', () => {
    for (const domain of TIME_DOMAINS) {
      const rests = capsForDomain(domain).map((cap) => restAfterMissionSec(mission(cap)));
      expect(new Set(rests).size).toBe(1);
    }
  });

  it('uses the agreed base for each domain', () => {
    expect(restAfterMissionSec(mission(5))).toBe(90);
    expect(restAfterMissionSec(mission(10))).toBe(150);
    expect(restAfterMissionSec(mission(15))).toBe(210);
    expect(restAfterMissionSec(mission(20))).toBe(300);
  });

  it('gives back more after a harder mission and less after an easy one', () => {
    expect(restAfterMissionSec(mission(15, 5))).toBe(270);
    expect(restAfterMissionSec(mission(15, 4))).toBe(270);
    expect(restAfterMissionSec(mission(15, 3))).toBe(210);
    expect(restAfterMissionSec(mission(15, 2))).toBe(180);
    expect(restAfterMissionSec(mission(15, 1))).toBe(180);
  });

  it('treats a missing tier as the middle, not as easy', () => {
    expect(restAfterMissionSec(mission(10, null))).toBe(restAfterMissionSec(mission(10, 3)));
    expect(restAfterMissionSec(mission(10))).toBe(restAfterMissionSec(mission(10, 3)));
  });

  it('rises with the clock at every tier', () => {
    for (const tier of [1, 3, 5]) {
      const rests = TIME_DOMAINS.map((domain) => restAfterMissionSec(mission(domain, tier)));
      for (let index = 1; index < rests.length; index += 1) {
        expect(rests[index]).toBeGreaterThan(rests[index - 1]);
      }
    }
  });

  it('never returns a rest the countdown cannot carry', () => {
    // set_rally_point_countdown refuses anything over 600s, so this is the
    // constraint that matters more than any of the numbers above.
    for (const cap of allTimeCaps()) {
      for (const tier of [null, 1, 2, 3, 4, 5]) {
        const rest = restAfterMissionSec(mission(cap, tier));
        expect(rest).toBeGreaterThanOrEqual(MIN_REST_SEC);
        expect(rest).toBeLessThanOrEqual(MAX_REST_SEC);
      }
    }
  });

  it('tops out at six minutes, well inside the timer limit', () => {
    const longest = Math.max(
      ...allTimeCaps().flatMap((cap) =>
        [null, 1, 2, 3, 4, 5].map((tier) => restAfterMissionSec(mission(cap, tier)))
      )
    );
    expect(longest).toBe(360);
  });

  it('refuses a clock no domain claims rather than guessing', () => {
    expect(() => restAfterMissionSec(mission(6))).toThrow(/no time domain/i);
    expect(() => restAfterMissionSec(mission(30))).toThrow(/no time domain/i);
  });
});

describe('chainRestPlan', () => {
  it('never rests before the first mission', () => {
    const plan = chainRestPlan([mission(10), mission(10)]);
    expect(plan[0].restBeforeSec).toBe(0);
  });

  it('takes each rest from the mission before it, not the one about to run', () => {
    const plan = chainRestPlan([mission(20), mission(5)]);
    // Rest is earned by the 20 just finished, not set by the 5 coming up.
    expect(plan[1].restBeforeSec).toBe(300);
  });

  it('recomputes when the order changes', () => {
    const forward = chainRestPlan([mission(5), mission(20)]);
    const reversed = chainRestPlan([mission(20), mission(5)]);
    expect(forward[1].restBeforeSec).toBe(90);
    expect(reversed[1].restBeforeSec).toBe(300);
  });

  it('handles an empty chain and a single mission', () => {
    expect(chainRestPlan([])).toEqual([]);
    expect(chainRestPlan([mission(15)])).toEqual([{ mission: mission(15), restBeforeSec: 0 }]);
  });
});

describe('chainTotalSec', () => {
  it('counts work and rest', () => {
    // 10 min work + 150s rest + 5 min work.
    expect(chainTotalSec([mission(10), mission(5)])).toBe(600 + 150 + 300);
  });

  it('is just the work for a single mission', () => {
    expect(chainTotalSec([mission(15)])).toBe(900);
  });

  it('is zero for an empty chain', () => {
    expect(chainTotalSec([])).toBe(0);
  });
});

describe('chainAdvisories', () => {
  it('says nothing about a Long mission that finishes the chain', () => {
    expect(chainAdvisories([mission(5), mission(20)])).toEqual([]);
    expect(chainAdvisories([mission(20)])).toEqual([]);
  });

  it('flags a Long mission that is not last', () => {
    const advisories = chainAdvisories([mission(20), mission(5)]);
    expect(advisories).toHaveLength(1);
    expect(advisories[0]).toMatchObject({ code: 'long-mission-not-last', index: 0 });
  });

  it('flags every Long mission that has work after it', () => {
    const advisories = chainAdvisories([mission(18), mission(25), mission(10)]);
    expect(advisories.map((advisory) => advisory.index)).toEqual([0, 1]);
  });

  it('treats the whole Long range the same way, not just 20', () => {
    for (const cap of capsForDomain(20)) {
      expect(chainAdvisories([mission(cap), mission(5)])).toHaveLength(1);
    }
  });

  it('leaves the shorter domains alone', () => {
    expect(chainAdvisories([mission(15), mission(15), mission(5)])).toEqual([]);
  });
});

describe('formatRestSec', () => {
  it('formats as m:ss', () => {
    expect(formatRestSec(90)).toBe('1:30');
    expect(formatRestSec(300)).toBe('5:00');
    expect(formatRestSec(60)).toBe('1:00');
    expect(formatRestSec(0)).toBe('0:00');
  });
});
