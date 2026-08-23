import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSessionState, logRound } from './sessionSync';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const ROUND_ID = '33333333-3333-4333-8333-333333333333';

describe('sessionSync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateSessionState calls RPC with correct args and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        session_id: SESSION_ID,
        state: 'work',
        time_left_sec: 897,
        is_paused: false,
        started_at: '2026-08-22T12:00:00.000Z',
        segment_index: 0,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await updateSessionState({
      sessionId: SESSION_ID,
      hostToken: 'host-secret',
      state: 'work',
      timeLeftSec: 897,
      isPaused: false,
      startedAt: '2026-08-22T12:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('update_session_state', {
      p_session_id: SESSION_ID,
      p_host_token: 'host-secret',
      p_state: 'work',
      p_time_left_sec: 897,
      p_is_paused: false,
      p_started_at: '2026-08-22T12:00:00.000Z',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      sessionId: SESSION_ID,
      state: 'work',
      timeLeftSec: 897,
      isPaused: false,
      startedAt: '2026-08-22T12:00:00.000Z',
      segmentIndex: 0,
    });
  });

  it('updateSessionState parses invalid_host_token without error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_host_token' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await updateSessionState({
      sessionId: SESSION_ID,
      hostToken: 'wrong',
      state: 'setup',
      timeLeftSec: 10,
      isPaused: false,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'invalid_host_token' });
  });

  it('updateSessionState maps RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session not found',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'PGRST116',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Session not found',
          details: '',
          hint: '',
          code: 'PGRST116',
        }),
      },
      success: false,
      count: null,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await updateSessionState({
      sessionId: SESSION_ID,
      hostToken: 'host-secret',
      state: 'setup',
      timeLeftSec: 10,
      isPaused: false,
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Session not found.');
  });

  it('logRound calls RPC with correct args and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        round_id: ROUND_ID,
        round_index: 2,
        elapsed_sec_at_round: 45,
        segment_index: 0,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await logRound({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      roundIndex: 2,
      elapsedSecAtRound: 45,
      segmentIndex: 0,
    });

    expect(rpcMock).toHaveBeenCalledWith('log_round', {
      p_session_id: SESSION_ID,
      p_participant_id: PARTICIPANT_ID,
      p_claim_token: 'claim-token',
      p_round_index: 2,
      p_elapsed_sec_at_round: 45,
      p_segment_index: 0,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      roundId: ROUND_ID,
      roundIndex: 2,
      elapsedSecAtRound: 45,
      segmentIndex: 0,
    });
  });

  it('logRound parses duplicate_round without error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'duplicate_round' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await logRound({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      roundIndex: 0,
      elapsedSecAtRound: 10,
      segmentIndex: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'duplicate_round' });
  });
});
