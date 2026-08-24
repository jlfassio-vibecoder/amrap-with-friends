import { describe, it, expect } from 'vitest';
import {
  buildLeaderboard,
  buildParticipantRoundSummaries,
  buildPresenceList,
  mergePresenceState,
  parseMessageRow,
  parseParticipantRow,
  parseRoundRow,
  parseSegmentResultRow,
  parseSessionRow,
  sortMessagesByCreatedAt,
  upsertMessage,
  upsertParticipant,
  upsertRound,
  upsertSegmentResult,
} from './sessionChannelUtils';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const HOST_ID = '22222222-2222-4222-8222-222222222222';
const JOINER_ID = '33333333-3333-4333-8333-333333333333';
const WORKOUT = [
  { name: 'Burpees', target: 10, unit: 'reps' as const },
  { name: 'Air squats', target: 10, unit: 'reps' as const },
];

describe('sessionChannelUtils', () => {
  it('parseSessionRow validates session shape', () => {
    const row = parseSessionRow({
      id: SESSION_ID,
      duration_minutes: 15,
      workout: [{ name: 'Burpees' }],
      state: 'waiting',
      time_left_sec: 10,
      is_paused: false,
      started_at: null,
      segment_index: 0,
      created_at: '2026-08-22T12:00:00.000Z',
    });

    expect(row?.state).toBe('waiting');
    expect(row?.duration_minutes).toBe(15);
  });

  it('mergePresenceState extracts online participants', () => {
    const merged = mergePresenceState({
      [HOST_ID]: [{ participant_id: HOST_ID, nickname: 'Host' }],
      [JOINER_ID]: [{ participant_id: JOINER_ID, nickname: 'Joiner' }],
    });

    expect(merged[HOST_ID]).toEqual({ nickname: 'Host' });
    expect(merged[JOINER_ID]).toEqual({ nickname: 'Joiner' });
  });

  it('buildPresenceList marks online from presence map', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseParticipantRow({
        id: JOINER_ID,
        session_id: SESSION_ID,
        nickname: 'Joiner',
        role: 'joiner',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const presence = buildPresenceList(participants, {
      [HOST_ID]: { nickname: 'Host' },
    });

    expect(presence).toEqual([
      { participantId: HOST_ID, nickname: 'Host', isOnline: true },
      { participantId: JOINER_ID, nickname: 'Joiner', isOnline: false },
    ]);
  });

  it('buildLeaderboard sorts by round count then nickname', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseParticipantRow({
        id: JOINER_ID,
        session_id: SESSION_ID,
        nickname: 'Joiner',
        role: 'joiner',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const rounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 0,
        elapsed_sec_at_round: 10,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 12,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'cccc3333-3333-4333-8333-333333333333',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 1,
        elapsed_sec_at_round: 30,
        segment_index: 0,
        created_at: '2026-08-22T12:00:01.000Z',
      })!,
    ];

    const leaderboard = buildLeaderboard(
      participants,
      rounds,
      [],
      0,
      HOST_ID,
      WORKOUT,
      5,
      'work'
    );
    expect(leaderboard[0].participantId).toBe(HOST_ID);
    expect(leaderboard[0].roundCount).toBe(2);
    expect(leaderboard[0].baseScore).toBe(40);
    expect(leaderboard[1].participantId).toBe(JOINER_ID);
    expect(leaderboard[1].roundCount).toBe(1);
    expect(leaderboard[1].baseScore).toBe(20);
  });

  it('buildLeaderboard ranks by baseScore when partial reps break round-count ties', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseParticipantRow({
        id: JOINER_ID,
        session_id: SESSION_ID,
        nickname: 'Joiner',
        role: 'joiner',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const rounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 10,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 0,
        elapsed_sec_at_round: 12,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const segmentResults = [
      parseSegmentResultRow({
        participant_id: HOST_ID,
        segment_index: 0,
        partial_reps: 15,
        updated_at: '2026-08-22T12:05:00.000Z',
      })!,
    ];

    const leaderboard = buildLeaderboard(
      participants,
      rounds,
      segmentResults,
      0,
      HOST_ID,
      WORKOUT,
      5,
      'work'
    );

    expect(leaderboard[0].participantId).toBe(HOST_ID);
    expect(leaderboard[0].baseScore).toBe(35);
    expect(leaderboard[1].participantId).toBe(JOINER_ID);
    expect(leaderboard[1].baseScore).toBe(20);
  });

  it('buildParticipantRoundSummaries computes per-round durations from elapsed timestamps', () => {
    const rounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 12,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 1,
        elapsed_sec_at_round: 30,
        segment_index: 0,
        created_at: '2026-08-22T12:00:01.000Z',
      })!,
    ];

    expect(buildParticipantRoundSummaries(rounds, HOST_ID, 0)).toEqual([
      { roundNumber: 1, durationSec: 12 },
      { roundNumber: 2, durationSec: 18 },
    ]);
  });

  it('buildLeaderboard includes per-round summaries', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const rounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 45,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    expect(
      buildLeaderboard(participants, rounds, [], 0, HOST_ID, WORKOUT, 5, 'work')[0].rounds
    ).toEqual([{ roundNumber: 1, durationSec: 45 }]);
  });

  it('buildLeaderboard ignores P.V.I. during work phase', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseParticipantRow({
        id: JOINER_ID,
        session_id: SESSION_ID,
        nickname: 'Joiner',
        role: 'joiner',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const hostRounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 60,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 1,
        elapsed_sec_at_round: 120,
        segment_index: 0,
        created_at: '2026-08-22T12:00:01.000Z',
      })!,
    ];
    const joinerRounds = [
      parseRoundRow({
        id: 'cccc3333-3333-4333-8333-333333333333',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 0,
        elapsed_sec_at_round: 60,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'dddd4444-4444-4444-8444-444444444444',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 1,
        elapsed_sec_at_round: 180,
        segment_index: 0,
        created_at: '2026-08-22T12:00:02.000Z',
      })!,
    ];

    const leaderboard = buildLeaderboard(
      participants,
      [...hostRounds, ...joinerRounds],
      [],
      0,
      HOST_ID,
      WORKOUT,
      5,
      'work'
    );

    expect(leaderboard[0].participantId).toBe(HOST_ID);
    expect(leaderboard[0].pvi).toBeNull();
    expect(leaderboard[0].finalScore).toBe(40);
    expect(leaderboard[1].finalScore).toBe(40);
  });

  it('buildLeaderboard re-ranks by final score at finished phase', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseParticipantRow({
        id: JOINER_ID,
        session_id: SESSION_ID,
        nickname: 'Joiner',
        role: 'joiner',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const hostRounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 60,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 1,
        elapsed_sec_at_round: 120,
        segment_index: 0,
        created_at: '2026-08-22T12:00:01.000Z',
      })!,
      parseRoundRow({
        id: 'eeee5555-5555-4555-8555-555555555555',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 2,
        elapsed_sec_at_round: 180,
        segment_index: 0,
        created_at: '2026-08-22T12:00:02.000Z',
      })!,
    ];
    const joinerRounds = [
      parseRoundRow({
        id: 'cccc3333-3333-4333-8333-333333333333',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 0,
        elapsed_sec_at_round: 60,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
      parseRoundRow({
        id: 'dddd4444-4444-4444-8444-444444444444',
        session_id: SESSION_ID,
        participant_id: JOINER_ID,
        round_index: 1,
        elapsed_sec_at_round: 180,
        segment_index: 0,
        created_at: '2026-08-22T12:00:02.000Z',
      })!,
    ];

    const leaderboard = buildLeaderboard(
      participants,
      [...hostRounds, ...joinerRounds],
      [],
      0,
      HOST_ID,
      WORKOUT,
      15,
      'finished'
    );

    expect(leaderboard[0].participantId).toBe(HOST_ID);
    expect(leaderboard[0].baseScore).toBe(60);
    expect(leaderboard[0].pvi).toBe(0);
    expect(leaderboard[0].pviMultiplier).toBe(1.15);
    expect(leaderboard[0].domainWeight).toBe(1.5);
    expect(leaderboard[0].finalScore).toBe(104);
    expect(leaderboard[1].participantId).toBe(JOINER_ID);
    expect(leaderboard[1].pvi).toBeNull();
    expect(leaderboard[1].pviMultiplier).toBe(1.0);
    expect(leaderboard[1].domainWeight).toBe(1.5);
    expect(leaderboard[1].finalScore).toBe(60);
  });

  it('parseSegmentResultRow and upsertSegmentResult handle segment results', () => {
    const result = parseSegmentResultRow({
      participant_id: HOST_ID,
      segment_index: 0,
      partial_reps: 7,
      final_score: null,
      score_breakdown: null,
      updated_at: '2026-08-22T12:05:00.000Z',
    })!;

    expect(result.partial_reps).toBe(7);
    expect(result.final_score).toBeNull();
    expect(result.score_breakdown).toBeNull();

    const locked = parseSegmentResultRow({
      participant_id: HOST_ID,
      segment_index: 0,
      partial_reps: 15,
      final_score: 302,
      score_breakdown: {
        baseScore: 175,
        pvi: 0,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
      },
      updated_at: '2026-08-22T12:06:00.000Z',
    })!;

    expect(locked.final_score).toBe(302);
    expect(locked.score_breakdown?.finalScore).toBe(302);

    const updated = parseSegmentResultRow({
      participant_id: HOST_ID,
      segment_index: 0,
      partial_reps: 9,
      final_score: null,
      score_breakdown: null,
      updated_at: '2026-08-22T12:06:00.000Z',
    })!;

    expect(upsertSegmentResult([result], updated)).toEqual([updated]);
    expect(upsertSegmentResult([], result)).toEqual([result]);
  });

  it('buildLeaderboard uses persisted locked score over client computation', () => {
    const participants = [
      parseParticipantRow({
        id: HOST_ID,
        session_id: SESSION_ID,
        nickname: 'Host',
        role: 'host',
        joined_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const rounds = [
      parseRoundRow({
        id: 'aaaa1111-1111-4111-8111-111111111111',
        session_id: SESSION_ID,
        participant_id: HOST_ID,
        round_index: 0,
        elapsed_sec_at_round: 999,
        segment_index: 0,
        created_at: '2026-08-22T12:00:00.000Z',
      })!,
    ];

    const segmentResults = [
      parseSegmentResultRow({
        participant_id: HOST_ID,
        segment_index: 0,
        partial_reps: 15,
        final_score: 302,
        score_breakdown: {
          baseScore: 175,
          pvi: 0,
          pviMultiplier: 1.15,
          domainWeight: 1.5,
          finalScore: 302,
        },
        updated_at: '2026-08-22T12:05:00.000Z',
      })!,
    ];

    const leaderboard = buildLeaderboard(
      participants,
      rounds,
      segmentResults,
      0,
      HOST_ID,
      WORKOUT,
      15,
      'finished'
    );

    expect(leaderboard[0].finalScore).toBe(302);
    expect(leaderboard[0].baseScore).toBe(175);
    expect(leaderboard[0].pviMultiplier).toBe(1.15);
    expect(leaderboard[0].domainWeight).toBe(1.5);
  });

  it('upsertParticipant and upsertRound avoid duplicates', () => {
    const participant = parseParticipantRow({
      id: HOST_ID,
      session_id: SESSION_ID,
      nickname: 'Host',
      role: 'host',
      joined_at: '2026-08-22T12:00:00.000Z',
    })!;

    const updated = parseParticipantRow({
      id: HOST_ID,
      session_id: SESSION_ID,
      nickname: 'Host Updated',
      role: 'host',
      joined_at: '2026-08-22T12:00:00.000Z',
    })!;

    expect(upsertParticipant([participant], updated)).toHaveLength(1);
    expect(upsertParticipant([participant], updated)[0].nickname).toBe('Host Updated');

    const round = parseRoundRow({
      id: 'aaaa1111-1111-4111-8111-111111111111',
      session_id: SESSION_ID,
      participant_id: HOST_ID,
      round_index: 0,
      elapsed_sec_at_round: 10,
      segment_index: 0,
      created_at: '2026-08-22T12:00:00.000Z',
    })!;

    expect(upsertRound([round], round)).toHaveLength(1);
    expect(upsertRound([], round)).toHaveLength(1);
  });

  it('parseMessageRow, upsertMessage, and sortMessagesByCreatedAt handle chat rows', () => {
    const messageA = parseMessageRow({
      id: 'dddd4444-4444-4444-8444-444444444444',
      session_id: SESSION_ID,
      participant_id: HOST_ID,
      nickname: 'Host',
      body: 'First',
      segment_index: 0,
      created_at: '2026-08-22T12:00:00.000Z',
    })!;

    const messageB = parseMessageRow({
      id: 'eeee5555-5555-4555-8555-555555555555',
      session_id: SESSION_ID,
      participant_id: JOINER_ID,
      nickname: 'Joiner',
      body: 'Second',
      segment_index: 0,
      created_at: '2026-08-22T12:00:01.000Z',
    })!;

    expect(upsertMessage([messageA], messageA)).toHaveLength(1);
    expect(upsertMessage([messageA], messageB)).toHaveLength(2);

    const sorted = sortMessagesByCreatedAt([messageB, messageA]);
    expect(sorted[0].id).toBe(messageA.id);
    expect(sorted[1].id).toBe(messageB.id);
  });
});
