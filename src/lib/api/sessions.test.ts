import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, joinSession } from './sessions';
import { supabase } from '@/lib/supabase';
import * as sessionIdentity from '@/lib/sessionIdentity';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/sessionIdentity', () => ({
  persistSessionIdentity: vi.fn(),
}));

const rpcMock = vi.mocked(supabase.rpc);
const persistMock = vi.mocked(sessionIdentity.persistSessionIdentity);

describe('sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession calls RPC, persists identity, and returns parsed result', async () => {
    rpcMock.mockResolvedValue({
      data: {
        session_id: 'session-1',
        host_token: 'host-secret',
        participant_id: 'participant-1',
        claim_token: 'claim-1',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await createSession({
      nickname: 'Host',
      durationMinutes: 15,
      workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
    });

    expect(rpcMock).toHaveBeenCalledWith('create_session', {
      p_duration_minutes: 15,
      p_nickname: 'Host',
      p_workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
    });
    expect(persistMock).toHaveBeenCalledWith('session-1', {
      nickname: 'Host',
      participantId: 'participant-1',
      hostToken: 'host-secret',
      claimToken: 'claim-1',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      sessionId: 'session-1',
      hostToken: 'host-secret',
      participantId: 'participant-1',
      claimToken: 'claim-1',
    });
  });

  it('createSession maps RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session is full (max 6 participants)',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
      },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await createSession({
      nickname: 'Host',
      durationMinutes: 15,
      workout: [{ name: 'Burpees' }],
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('This session is full (max 6 participants).');
  });

  it('joinSession calls RPC and never accepts host_token in response', async () => {
    rpcMock.mockResolvedValue({
      data: {
        participant_id: 'participant-2',
        claim_token: 'claim-2',
        host_token: 'should-not-be-here',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await joinSession({
      sessionId: 'session-1',
      nickname: 'Guest',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('joinSession persists identity on success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        participant_id: 'participant-2',
        claim_token: 'claim-2',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await joinSession({
      sessionId: 'session-1',
      nickname: 'Guest',
    });

    expect(rpcMock).toHaveBeenCalledWith('join_session', {
      p_session_id: 'session-1',
      p_nickname: 'Guest',
    });
    expect(persistMock).toHaveBeenCalledWith('session-1', {
      nickname: 'Guest',
      participantId: 'participant-2',
      claimToken: 'claim-2',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      participantId: 'participant-2',
      claimToken: 'claim-2',
    });
  });
});
