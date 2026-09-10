import { describe, expect, it } from 'vitest';
import {
  campaignSquadProgressStatusLabel,
  computeCampaignSquadProgress,
  type CampaignSquadProgressInput,
  type SquadProgressOccurrence,
} from './computeCampaignSquadProgress';
import type { CampaignStandingsMember, CampaignStandingsScore } from './computeCampaignStandings';

function member(
  userId: string,
  overrides: Partial<CampaignStandingsMember> = {}
): CampaignStandingsMember {
  return {
    userId,
    nickname: userId.toUpperCase(),
    joinedLocalDate: '2026-10-01',
    left: false,
    ...overrides,
  };
}

function occurrence(
  occurrenceId: string,
  sequence: number,
  localDate: string,
  status: SquadProgressOccurrence['status'] = 'done'
): SquadProgressOccurrence {
  return { occurrenceId, sequence, localDate, status };
}

function score(
  occurrenceId: string,
  userId: string,
  finalScore: number | null
): CampaignStandingsScore {
  return { occurrenceId, userId, finalScore };
}

function input(partial: Partial<CampaignSquadProgressInput>): CampaignSquadProgressInput {
  return {
    members: [],
    occurrences: [],
    scores: [],
    ...partial,
  };
}

describe('campaignSquadProgressStatusLabel', () => {
  it('labels on track and makeup debt in plain English', () => {
    expect(campaignSquadProgressStatusLabel(0)).toBe('On track');
    expect(campaignSquadProgressStatusLabel(1)).toBe('1 to make up');
    expect(campaignSquadProgressStatusLabel(3)).toBe('3 to make up');
  });
});

describe('computeCampaignSquadProgress', () => {
  it('reports attendance and owed separately, debt-first', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [
          member('coach', { nickname: 'Coach' }),
          member('britt', { nickname: 'Britt' }),
          member('tom', { nickname: 'Tom' }),
        ],
        occurrences: [
          occurrence('o1', 1, '2026-10-05'),
          occurrence('o2', 2, '2026-10-07'),
          occurrence('o3', 3, '2026-10-09'),
          occurrence('o4', 4, '2026-10-12'),
        ],
        scores: [
          score('o1', 'coach', 100),
          score('o2', 'coach', 90),
          score('o3', 'coach', 95),
          score('o4', 'coach', 88),
          score('o1', 'britt', 94),
          score('o1', 'tom', 80),
          score('o2', 'tom', 82),
          score('o3', 'tom', 70),
        ],
      })
    );

    expect(rows.map((row) => row.userId)).toEqual(['britt', 'tom', 'coach']);
    expect(rows[0]).toMatchObject({
      nickname: 'Britt',
      attended: 1,
      eligible: 4,
      owedCount: 3,
      oldestOwedLocalDate: '2026-10-07',
    });
    expect(rows[1]).toMatchObject({
      nickname: 'Tom',
      attended: 3,
      eligible: 4,
      owedCount: 1,
      oldestOwedLocalDate: '2026-10-12',
    });
    expect(rows[2]).toMatchObject({
      nickname: 'Coach',
      attended: 4,
      eligible: 4,
      owedCount: 0,
      oldestOwedLocalDate: null,
    });
  });

  it('does not treat generated open missions as makeup debt', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [member('a')],
        occurrences: [
          occurrence('o1', 1, '2026-10-05', 'done'),
          occurrence('o2', 2, '2026-10-07', 'generated'),
        ],
        scores: [score('o1', 'a', 40)],
      })
    );

    expect(rows[0]).toMatchObject({
      attended: 1,
      eligible: 2,
      owedCount: 0,
    });
  });

  it('does not inflate owed for forfeited missions', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [member('a')],
        occurrences: [occurrence('o1', 1, '2026-10-05'), occurrence('o2', 2, '2026-10-07')],
        scores: [score('o1', 'a', 40)],
        forfeits: [{ occurrenceId: 'o2', userId: 'a' }],
      })
    );

    expect(rows[0]).toMatchObject({ attended: 1, eligible: 2, owedCount: 0 });
  });

  it('ignores missions before the member joined', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [member('late', { joinedLocalDate: '2026-10-08' })],
        occurrences: [occurrence('o1', 1, '2026-10-05'), occurrence('o2', 2, '2026-10-09')],
        scores: [],
      })
    );

    expect(rows[0]).toMatchObject({
      attended: 0,
      eligible: 1,
      owedCount: 1,
      oldestOwedLocalDate: '2026-10-09',
    });
  });

  it('sorts equal debt by oldest owed date then nickname', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [member('b', { nickname: 'Blake' }), member('a', { nickname: 'Alex' })],
        occurrences: [occurrence('o1', 1, '2026-10-05'), occurrence('o2', 2, '2026-10-07')],
        scores: [score('o2', 'b', 50), score('o1', 'a', 50)],
      })
    );

    // Both owe 1; Blake's oldest owed is o1 (earlier), Alex's is o2.
    expect(rows.map((row) => row.userId)).toEqual(['b', 'a']);
  });

  it('does not count null scores as attendance', () => {
    const rows = computeCampaignSquadProgress(
      input({
        members: [member('host')],
        occurrences: [occurrence('o1', 1, '2026-10-05')],
        scores: [score('o1', 'host', null)],
      })
    );

    expect(rows[0]).toMatchObject({ attended: 0, eligible: 1, owedCount: 1 });
  });
});
