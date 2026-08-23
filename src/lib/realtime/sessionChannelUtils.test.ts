import { describe, it, expect } from 'vitest';
import {
  buildLeaderboard,
  buildPresenceList,
  mergePresenceState,
  parseMessageRow,
  parseParticipantRow,
  parseRoundRow,
  parseSessionRow,
  sortMessagesByCreatedAt,
  upsertMessage,
  upsertParticipant,
  upsertRound,
} from './sessionChannelUtils';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const HOST_ID = '22222222-2222-4222-8222-222222222222';
const JOINER_ID = '33333333-3333-4333-8333-333333333333';

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

    const leaderboard = buildLeaderboard(participants, rounds, 0, HOST_ID);
    expect(leaderboard[0].participantId).toBe(HOST_ID);
    expect(leaderboard[0].roundCount).toBe(2);
    expect(leaderboard[1].participantId).toBe(JOINER_ID);
    expect(leaderboard[1].roundCount).toBe(1);
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
