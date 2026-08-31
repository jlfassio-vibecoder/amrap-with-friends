import { describe, expect, it } from 'vitest';
import {
  computeCampaignStandings,
  type CampaignStandingsInput,
  type CampaignStandingsMember,
  type CampaignStandingsOccurrence,
  type CampaignStandingsScore,
} from './computeCampaignStandings';

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
  localDate: string,
  status: CampaignStandingsOccurrence['status'] = 'done'
): CampaignStandingsOccurrence {
  return { occurrenceId, localDate, status };
}

function score(
  occurrenceId: string,
  userId: string,
  finalScore: number | null,
  madeUp = false
): CampaignStandingsScore {
  return { occurrenceId, userId, finalScore, madeUp: madeUp || undefined };
}

function input(partial: Partial<CampaignStandingsInput>): CampaignStandingsInput {
  return {
    members: [],
    occurrences: [],
    scores: [],
    ...partial,
  };
}

describe('computeCampaignStandings', () => {
  it('ranks on normalised average and reports attendance separately', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('a', { nickname: 'Alex' }), member('b', { nickname: 'Blake' })],
        occurrences: [occurrence('o1', '2026-10-05'), occurrence('o2', '2026-10-07')],
        scores: [
          score('o1', 'a', 100),
          score('o1', 'b', 50),
          score('o2', 'a', 80),
          score('o2', 'b', 80),
        ],
      })
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      userId: 'a',
      rank: 1,
      normalisedAverage: 1,
      attended: 2,
      eligible: 2,
    });
    expect(rows[1]).toMatchObject({
      userId: 'b',
      rank: 2,
      // (0.5 + 1.0) / 2
      normalisedAverage: 0.75,
      attended: 2,
      eligible: 2,
    });
  });

  it('does not treat an unscored row as attendance', () => {
    // The scheduler seeds a host participant into every generated mission, so
    // the host used to ship a score row for missions they skipped. Counting
    // those overstated attendance and averaged the absences in as zeros.
    const rows = computeCampaignStandings(
      input({
        members: [member('host'), member('b')],
        occurrences: [
          occurrence('o1', '2026-10-05'),
          occurrence('o2', '2026-10-07'),
          occurrence('o3', '2026-10-09'),
        ],
        scores: [
          score('o1', 'host', 90),
          score('o1', 'b', 100),
          score('o2', 'b', 100),
          score('o3', 'b', 100),
          // Host was enrolled in o2/o3 but never trained them.
          { occurrenceId: 'o2', userId: 'host', finalScore: null },
          { occurrenceId: 'o3', userId: 'host', finalScore: null },
        ],
      })
    );

    const host = rows.find((row) => row.userId === 'host');
    expect(host).toMatchObject({ attended: 1, eligible: 3 });
    expect(host?.normalisedAverage).toBeCloseTo(0.9, 5);
    // Trained once and trained it well: ahead of nobody here, but not last on
    // a 0.3 average dragged down by two absences.
    expect(rows[0].userId).toBe('b');
    expect(rows[1].userId).toBe('host');
  });

  it('gives a member who attended nothing a null average and ranks them last', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('a'), member('b')],
        occurrences: [occurrence('o1', '2026-10-05')],
        scores: [score('o1', 'a', 40)],
      })
    );

    expect(rows[0].userId).toBe('a');
    expect(rows[0].normalisedAverage).toBe(1);
    expect(rows[1]).toMatchObject({
      userId: 'b',
      normalisedAverage: null,
      attended: 0,
      eligible: 1,
      rank: 2,
    });
  });

  it('ignores occurrences before a mid-join for the attendance denominator', () => {
    const rows = computeCampaignStandings(
      input({
        members: [
          member('early', { joinedLocalDate: '2026-10-01', nickname: 'Early' }),
          member('late', { joinedLocalDate: '2026-10-10', nickname: 'Late' }),
        ],
        occurrences: [
          occurrence('o1', '2026-10-05'),
          occurrence('o2', '2026-10-12'),
          occurrence('o3', '2026-10-14'),
        ],
        scores: [
          score('o1', 'early', 100),
          score('o2', 'early', 50),
          score('o2', 'late', 100),
          score('o3', 'late', 80),
        ],
      })
    );

    const early = rows.find((row) => row.userId === 'early')!;
    const late = rows.find((row) => row.userId === 'late')!;

    expect(early.eligible).toBe(3);
    expect(early.attended).toBe(2);
    expect(late.eligible).toBe(2);
    expect(late.attended).toBe(2);
    // Late: 1.0 on o2, 1.0 on o3 (solo or best) → average 1
    expect(late.normalisedAverage).toBe(1);
  });

  it('treats a single-attendee occurrence as ratio 1.0', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('solo')],
        occurrences: [occurrence('o1', '2026-10-05')],
        scores: [score('o1', 'solo', 12)],
      })
    );

    expect(rows[0]).toMatchObject({
      normalisedAverage: 1,
      attended: 1,
      eligible: 1,
      rank: 1,
    });
  });

  it('treats a missing final_score as absence, not as a zero score', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('a'), member('b')],
        occurrences: [occurrence('o1', '2026-10-05')],
        scores: [score('o1', 'a', null), score('o1', 'b', 40)],
      })
    );

    expect(rows[0].userId).toBe('b');
    expect(rows[0].normalisedAverage).toBe(1);
    expect(rows[1]).toMatchObject({
      userId: 'a',
      normalisedAverage: null,
      attended: 0,
    });
  });

  it('keeps left members in the standings with a left flag', () => {
    const rows = computeCampaignStandings(
      input({
        members: [
          member('active', { nickname: 'Active' }),
          member('gone', { nickname: 'Gone', left: true }),
        ],
        occurrences: [occurrence('o1', '2026-10-05')],
        scores: [score('o1', 'active', 30), score('o1', 'gone', 60)],
      })
    );

    expect(rows[0]).toMatchObject({ userId: 'gone', left: true, rank: 1, normalisedAverage: 1 });
    expect(rows[1]).toMatchObject({ userId: 'active', left: false, rank: 2 });
  });

  it('counts generated, done, and skipped occurrences toward eligibility', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('a')],
        occurrences: [
          occurrence('o1', '2026-10-05', 'done'),
          occurrence('o2', '2026-10-07', 'generated'),
          occurrence('o3', '2026-10-09', 'planned'),
          occurrence('o4', '2026-10-11', 'skipped'),
        ],
        scores: [score('o1', 'a', 10)],
      })
    );

    expect(rows[0]).toMatchObject({ attended: 1, eligible: 3 });
  });

  it('flags members who have at least one makeup score', () => {
    const rows = computeCampaignStandings(
      input({
        members: [member('a'), member('b')],
        occurrences: [occurrence('o1', '2026-10-05'), occurrence('o2', '2026-10-07')],
        scores: [
          score('o1', 'a', 100, true),
          score('o1', 'b', 90),
          score('o2', 'a', 80),
          score('o2', 'b', 80),
        ],
      })
    );

    expect(rows.find((row) => row.userId === 'a')).toMatchObject({ hasMadeUp: true });
    expect(rows.find((row) => row.userId === 'b')).toMatchObject({ hasMadeUp: false });
  });
});
