import { describe, expect, it } from 'vitest';
import {
  computeCampaignTestProgress,
  formatCampaignRepDelta,
  formatCampaignRepScore,
  type TestProgressOccurrence,
} from './computeCampaignTestProgress';
import type { CampaignStandingsMember, CampaignStandingsScore } from './computeCampaignStandings';

function occurrence(
  overrides: Partial<TestProgressOccurrence> &
    Pick<TestProgressOccurrence, 'occurrenceId' | 'templateId'>
): TestProgressOccurrence {
  return {
    weekNumber: 1,
    localDate: '2026-03-02',
    ...overrides,
  };
}

function member(
  overrides: Partial<CampaignStandingsMember> & Pick<CampaignStandingsMember, 'userId'>
): CampaignStandingsMember {
  return {
    nickname: overrides.userId,
    joinedLocalDate: '2026-03-01',
    left: false,
    ...overrides,
  };
}

describe('computeCampaignTestProgress', () => {
  it('returns null when the schedule has no recoverable benchmark', () => {
    // A plain rotation repeats far more often than any campaign tests.
    const rotation = ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'].map((templateId, index) =>
      occurrence({
        occurrenceId: `o${index + 1}`,
        templateId,
        weekNumber: index + 1,
        localDate: `2026-03-${String(index + 1).padStart(2, '0')}`,
      })
    );

    expect(
      computeCampaignTestProgress({
        occurrences: rotation,
        members: [member({ userId: 'u1' })],
        scores: [],
      })
    ).toBeNull();
  });

  it('returns null for an empty crew or calendar', () => {
    expect(
      computeCampaignTestProgress({
        occurrences: [],
        members: [member({ userId: 'u1' })],
        scores: [],
      })
    ).toBeNull();
    expect(
      computeCampaignTestProgress({
        occurrences: [
          occurrence({ occurrenceId: 'o1', templateId: 'a', weekNumber: 1 }),
          occurrence({ occurrenceId: 'o2', templateId: 'b', weekNumber: 1 }),
          occurrence({ occurrenceId: 'o3', templateId: 'c', weekNumber: 2 }),
          occurrence({ occurrenceId: 'o4', templateId: 'a', weekNumber: 2 }),
        ],
        members: [],
        scores: [],
      })
    ).toBeNull();
  });

  it('shows Week 1 with empty retest when only the benchmark is scored', () => {
    const occurrences = [
      occurrence({
        occurrenceId: 'bench',
        templateId: 'flash-flood',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'build',
        templateId: 'other',
        weekNumber: 1,
        localDate: '2026-03-04',
      }),
      occurrence({
        occurrenceId: 'build2',
        templateId: 'other-2',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'retest',
        templateId: 'flash-flood',
        weekNumber: 2,
        localDate: '2026-03-11',
      }),
    ];

    const result = computeCampaignTestProgress({
      occurrences,
      members: [member({ userId: 'u1', nickname: 'Maya' })],
      scores: [{ occurrenceId: 'bench', userId: 'u1', finalScore: 40 }],
    });

    expect(result).not.toBeNull();
    expect(result?.hasBenchmarkScore).toBe(true);
    expect(result?.rows).toEqual([
      {
        userId: 'u1',
        nickname: 'Maya',
        left: false,
        benchmarkScore: 40,
        retestScore: null,
        delta: null,
      },
    ]);
  });

  it('uses the chronologically latest scored retest for the delta', () => {
    // 6-week, 1/week: benchmark, build, mid retest, build, build, final retest
    const occurrences: TestProgressOccurrence[] = [
      occurrence({
        occurrenceId: 'b',
        templateId: 'a',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'x1',
        templateId: 'b',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'mid',
        templateId: 'a',
        weekNumber: 3,
        localDate: '2026-03-16',
      }),
      occurrence({
        occurrenceId: 'x2',
        templateId: 'c',
        weekNumber: 4,
        localDate: '2026-03-23',
      }),
      occurrence({
        occurrenceId: 'x3',
        templateId: 'd',
        weekNumber: 5,
        localDate: '2026-03-30',
      }),
      occurrence({
        occurrenceId: 'final',
        templateId: 'a',
        weekNumber: 6,
        localDate: '2026-04-06',
      }),
    ];

    const midOnly = computeCampaignTestProgress({
      occurrences,
      members: [member({ userId: 'u1' })],
      scores: [
        { occurrenceId: 'b', userId: 'u1', finalScore: 30 },
        { occurrenceId: 'mid', userId: 'u1', finalScore: 35 },
      ],
    });
    expect(midOnly?.rows[0]).toMatchObject({
      benchmarkScore: 30,
      retestScore: 35,
      delta: 5,
    });

    const withFinale = computeCampaignTestProgress({
      occurrences,
      members: [member({ userId: 'u1' })],
      scores: [
        { occurrenceId: 'b', userId: 'u1', finalScore: 30 },
        { occurrenceId: 'mid', userId: 'u1', finalScore: 35 },
        { occurrenceId: 'final', userId: 'u1', finalScore: 42 },
      ],
    });
    expect(withFinale?.rows[0]).toMatchObject({
      benchmarkScore: 30,
      retestScore: 42,
      delta: 12,
    });
  });

  it('does not invent a Week 1 score for someone who joined after the benchmark', () => {
    const occurrences = [
      occurrence({
        occurrenceId: 'b',
        templateId: 'a',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'x',
        templateId: 'b',
        weekNumber: 1,
        localDate: '2026-03-04',
      }),
      occurrence({
        occurrenceId: 'y',
        templateId: 'c',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'r',
        templateId: 'a',
        weekNumber: 2,
        localDate: '2026-03-11',
      }),
    ];

    const scores: CampaignStandingsScore[] = [
      { occurrenceId: 'b', userId: 'late', finalScore: 99 },
      { occurrenceId: 'r', userId: 'late', finalScore: 50 },
    ];

    const result = computeCampaignTestProgress({
      occurrences,
      members: [member({ userId: 'late', joinedLocalDate: '2026-03-10' })],
      scores,
    });

    expect(result?.rows[0]).toMatchObject({
      benchmarkScore: null,
      retestScore: 50,
      delta: null,
    });
  });

  it('includes left members and ranks by delta', () => {
    const occurrences = [
      occurrence({
        occurrenceId: 'b',
        templateId: 'a',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'x',
        templateId: 'b',
        weekNumber: 1,
        localDate: '2026-03-04',
      }),
      occurrence({
        occurrenceId: 'y',
        templateId: 'c',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'r',
        templateId: 'a',
        weekNumber: 2,
        localDate: '2026-03-11',
      }),
    ];

    const result = computeCampaignTestProgress({
      occurrences,
      members: [
        member({ userId: 'u1', nickname: 'Ada', left: true }),
        member({ userId: 'u2', nickname: 'Ben' }),
      ],
      scores: [
        { occurrenceId: 'b', userId: 'u1', finalScore: 40 },
        { occurrenceId: 'r', userId: 'u1', finalScore: 38 },
        { occurrenceId: 'b', userId: 'u2', finalScore: 40 },
        { occurrenceId: 'r', userId: 'u2', finalScore: 48 },
      ],
    });

    expect(result?.rows.map((row) => row.userId)).toEqual(['u2', 'u1']);
    expect(result?.rows[0].delta).toBe(8);
    expect(result?.rows[1]).toMatchObject({ left: true, delta: -2 });
  });

  it('treats a missing or non-finite score as absent', () => {
    const occurrences = [
      occurrence({
        occurrenceId: 'b',
        templateId: 'a',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'x',
        templateId: 'b',
        weekNumber: 1,
        localDate: '2026-03-04',
      }),
      occurrence({
        occurrenceId: 'y',
        templateId: 'c',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'r',
        templateId: 'a',
        weekNumber: 2,
        localDate: '2026-03-11',
      }),
    ];

    const result = computeCampaignTestProgress({
      occurrences,
      members: [member({ userId: 'u1' })],
      scores: [
        { occurrenceId: 'b', userId: 'u1', finalScore: null },
        { occurrenceId: 'r', userId: 'u1', finalScore: Number.NaN },
      ],
    });

    expect(result?.hasBenchmarkScore).toBe(false);
    expect(result?.rows[0]).toMatchObject({
      benchmarkScore: null,
      retestScore: null,
      delta: null,
    });
  });

  describe('a campaign that is over', () => {
    const occurrences = [
      occurrence({
        occurrenceId: 'bench',
        templateId: 'flash-flood',
        weekNumber: 1,
        localDate: '2026-03-02',
      }),
      occurrence({
        occurrenceId: 'build',
        templateId: 'other',
        weekNumber: 1,
        localDate: '2026-03-04',
      }),
      occurrence({
        occurrenceId: 'build2',
        templateId: 'other-2',
        weekNumber: 2,
        localDate: '2026-03-09',
      }),
      occurrence({
        occurrenceId: 'retest',
        templateId: 'flash-flood',
        weekNumber: 2,
        localDate: '2026-03-11',
      }),
    ];
    const members = [member({ userId: 'u1', nickname: 'Maya' })];

    it('shows nothing once it is ended early with no benchmark score', () => {
      // Nothing ran and nothing ever will, so "Scores show up after the
      // opening benchmark" would be waiting for something that cannot arrive.
      expect(
        computeCampaignTestProgress({
          occurrences,
          members,
          scores: [],
          campaignStatus: 'abandoned',
        })
      ).toBeNull();
    });

    it('shows nothing once it is complete with no benchmark score', () => {
      expect(
        computeCampaignTestProgress({
          occurrences,
          members,
          scores: [],
          campaignStatus: 'complete',
        })
      ).toBeNull();
    });

    it('keeps the result of a campaign that finished and was scored', () => {
      // The payoff of running the whole thing — hiding this on completion
      // would throw away the number the campaign exists to produce.
      const result = computeCampaignTestProgress({
        occurrences,
        members,
        scores: [
          { occurrenceId: 'bench', userId: 'u1', finalScore: 40 },
          { occurrenceId: 'retest', userId: 'u1', finalScore: 48 },
        ],
        campaignStatus: 'complete',
      });
      expect(result?.rows[0].delta).toBe(8);
    });

    it('keeps the work done before an early ending', () => {
      const result = computeCampaignTestProgress({
        occurrences,
        members,
        scores: [{ occurrenceId: 'bench', userId: 'u1', finalScore: 40 }],
        campaignStatus: 'abandoned',
      });
      expect(result?.hasBenchmarkScore).toBe(true);
      expect(result?.rows[0].benchmarkScore).toBe(40);
    });

    it('still waits for the benchmark while the campaign is live', () => {
      const result = computeCampaignTestProgress({
        occurrences,
        members,
        scores: [],
        campaignStatus: 'active',
      });
      expect(result).not.toBeNull();
      expect(result?.hasBenchmarkScore).toBe(false);
    });

    it('shows the section when no status is given at all', () => {
      expect(computeCampaignTestProgress({ occurrences, members, scores: [] })).not.toBeNull();
    });
  });
});

describe('formatCampaignRepScore / formatCampaignRepDelta', () => {
  it('formats scores and deltas', () => {
    expect(formatCampaignRepScore(42)).toBe('42 reps');
    expect(formatCampaignRepScore(null)).toBe('—');
    expect(formatCampaignRepDelta(8)).toBe('+8 reps');
    expect(formatCampaignRepDelta(-3)).toBe('−3 reps');
    expect(formatCampaignRepDelta(0)).toBe('0 reps');
    expect(formatCampaignRepDelta(null)).toBe('—');
  });
});
