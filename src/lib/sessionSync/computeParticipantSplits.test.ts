import { describe, it, expect } from 'vitest';
import {
  computeParticipantSplits,
  formatSplitDuration,
} from './computeParticipantSplits';
import type { RoundRow } from '@/lib/sessionSync/types';

const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function makeRound(
  overrides: Partial<RoundRow> & Pick<RoundRow, 'round_index' | 'elapsed_sec_at_round'>
): RoundRow {
  return {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    session_id: SESSION_ID,
    participant_id: PARTICIPANT_ID,
    segment_index: 0,
    created_at: '2026-08-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('computeParticipantSplits', () => {
  it('returns an empty array when no rounds are logged', () => {
    expect(computeParticipantSplits([], PARTICIPANT_ID, 0)).toEqual([]);
  });

  it('computes a single-round split from elapsed_sec_at_round', () => {
    const rounds = [makeRound({ round_index: 0, elapsed_sec_at_round: 45 })];

    expect(computeParticipantSplits(rounds, PARTICIPANT_ID, 0)).toEqual([
      { roundNumber: 1, durationSec: 45 },
    ]);
  });

  it('computes multi-round splits from elapsed deltas', () => {
    const rounds = [
      makeRound({ round_index: 0, elapsed_sec_at_round: 12 }),
      makeRound({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        round_index: 1,
        elapsed_sec_at_round: 30,
      }),
    ];

    expect(computeParticipantSplits(rounds, PARTICIPANT_ID, 0)).toEqual([
      { roundNumber: 1, durationSec: 12 },
      { roundNumber: 2, durationSec: 18 },
    ]);
  });

  it('filters by participant and segment index', () => {
    const rounds = [
      makeRound({ round_index: 0, elapsed_sec_at_round: 10 }),
      makeRound({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        participant_id: OTHER_ID,
        round_index: 0,
        elapsed_sec_at_round: 99,
      }),
      makeRound({
        id: 'cccc3333-3333-4333-8333-333333333333',
        round_index: 0,
        segment_index: 1,
        elapsed_sec_at_round: 50,
      }),
    ];

    expect(computeParticipantSplits(rounds, PARTICIPANT_ID, 0)).toEqual([
      { roundNumber: 1, durationSec: 10 },
    ]);
  });
});

describe('formatSplitDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatSplitDuration(47)).toBe('0:47');
    expect(formatSplitDuration(125)).toBe('2:05');
  });
});
