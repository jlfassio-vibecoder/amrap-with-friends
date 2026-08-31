import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  fetchHostActiveSessionCount,
  joinSession,
  updateSessionScheduledAt,
} from './sessions';
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

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

describe('sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession calls RPC, persists identity, and returns parsed result', async () => {
    rpcMock.mockResolvedValue({
      data: {
        session_id: SESSION_ID,
        host_token: 'host-secret',
        participant_id: PARTICIPANT_ID,
        claim_token: 'claim-1',
      },
      error: null,
      success: true,
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
      p_template_id: null,
      p_intensity_tier: null,
      p_scheduled_at: null,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(persistMock).toHaveBeenCalledWith(SESSION_ID, {
      nickname: 'Host',
      participantId: PARTICIPANT_ID,
      hostToken: 'host-secret',
      claimToken: 'claim-1',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      sessionId: SESSION_ID,
      hostToken: 'host-secret',
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-1',
    });
  });

  it('createSession maps RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session is full',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Session is full',
          details: '',
          hint: '',
          code: 'P0001',
        }),
      },
      success: false,
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
    expect(result.error?.message).toBe('This session is full.');
  });

  it('createSession passes scheduledAt and maps rally/cap RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Host session limit reached',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Host session limit reached',
          details: '',
          hint: '',
          code: 'P0001',
        }),
      },
      success: false,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const scheduledAt = '2026-08-25T16:30:00.000Z';
    const result = await createSession({
      nickname: 'Host',
      durationMinutes: 15,
      workout: [{ name: 'Burpees' }],
      scheduledAt,
    });

    expect(rpcMock).toHaveBeenCalledWith('create_session', {
      p_duration_minutes: 15,
      p_nickname: 'Host',
      p_workout: [{ name: 'Burpees' }],
      p_template_id: null,
      p_intensity_tier: null,
      p_scheduled_at: scheduledAt,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('You already have 3 active sessions.');
  });

  it('fetchHostActiveSessionCount returns the host queue size', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, count: 2 },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await fetchHostActiveSessionCount();

    expect(rpcMock).toHaveBeenCalledWith('host_active_session_count', {});
    expect(result.error).toBeNull();
    expect(result.data).toBe(2);
  });

  it('joinSession rejects invalid session ID before RPC', async () => {
    const result = await joinSession({
      sessionId: 'not-a-uuid',
      nickname: 'Guest',
    });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Enter a valid session ID (UUID format).');
  });

  it('joinSession maps full-session RPC error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session is full',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Session is full',
          details: '',
          hint: '',
          code: 'P0001',
        }),
      },
      success: false,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'Guest',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('This session is full.');
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('joinSession surfaces generic full error when session already has 100 participants (101st join)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session is full',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Session is full',
          details: '',
          hint: '',
          code: 'P0001',
        }),
      },
      success: false,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'Guest 101',
    });

    expect(rpcMock).toHaveBeenCalledWith('join_session', {
      p_session_id: SESSION_ID,
      p_nickname: 'Guest 101',
    });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('This session is full.');
  });

  it('joinSession persists host reclaim with host_token and no claim_token', async () => {
    rpcMock.mockResolvedValue({
      data: {
        participant_id: '33333333-3333-4333-8333-333333333333',
        nickname: 'Coach',
        role: 'host',
        claim_token: null,
        host_token: 'host-secret',
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'coach',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      participantId: '33333333-3333-4333-8333-333333333333',
      claimToken: null,
      hostToken: 'host-secret',
      nickname: 'Coach',
      role: 'host',
    });
    expect(persistMock).toHaveBeenCalledWith(SESSION_ID, {
      nickname: 'Coach',
      participantId: '33333333-3333-4333-8333-333333333333',
      hostToken: 'host-secret',
    });
  });

  it('joinSession rejects responses with neither claim_token nor host_token', async () => {
    rpcMock.mockResolvedValue({
      data: {
        participant_id: '33333333-3333-4333-8333-333333333333',
        claim_token: null,
        host_token: null,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'Guest',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('joinSession maps Session locked RPC error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session locked',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Session locked',
          details: '',
          hint: '',
          code: 'P0001',
        }),
      },
      success: false,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'Guest',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('SESSION LOCKED. THE RALLY HAS DEPARTED.');
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('joinSession persists identity on success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        participant_id: '33333333-3333-4333-8333-333333333333',
        claim_token: 'claim-2',
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await joinSession({
      sessionId: SESSION_ID,
      nickname: 'Guest',
    });

    expect(rpcMock).toHaveBeenCalledWith('join_session', {
      p_session_id: SESSION_ID,
      p_nickname: 'Guest',
    });
    expect(persistMock).toHaveBeenCalledWith(SESSION_ID, {
      nickname: 'Guest',
      participantId: '33333333-3333-4333-8333-333333333333',
      claimToken: 'claim-2',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      participantId: '33333333-3333-4333-8333-333333333333',
      claimToken: 'claim-2',
      hostToken: null,
      nickname: 'Guest',
      role: 'joiner',
    });
  });
});

describe('updateSessionScheduledAt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC and returns updated scheduled time', async () => {
    const scheduledAt = '2026-08-25T23:30:00.000Z';
    rpcMock.mockResolvedValue({
      data: { ok: true, scheduled_at: scheduledAt },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await updateSessionScheduledAt({
      sessionId: SESSION_ID,
      scheduledAt,
    });

    expect(rpcMock).toHaveBeenCalledWith('update_session_scheduled_at', {
      p_session_id: SESSION_ID,
      p_scheduled_at: scheduledAt,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ scheduledAt });
  });

  it('maps host and waiting guard errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Session is not waiting',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON() {
          return {
            message: this.message,
            name: this.name,
            details: this.details,
            hint: this.hint,
            code: this.code,
          };
        },
      },
      count: null,
      status: 400,
      statusText: 'Bad Request',
      success: false,
    });

    const result = await updateSessionScheduledAt({
      sessionId: SESSION_ID,
      scheduledAt: '2026-08-25T23:30:00.000Z',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe(
      'Rally time can only be changed while waiting at the rally point.'
    );
  });
});
