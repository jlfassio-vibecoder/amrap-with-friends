import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLobbySession, joinLobby, passLobbyCommand, startNextLobbySession } from './lobby';
import { supabase } from '@/lib/supabase';
import * as sessionIdentity from '@/lib/sessionIdentity';
import * as lobbyIdentity from '@/lib/lobbyIdentity';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock('@/lib/sessionIdentity', () => ({
  persistSessionIdentity: vi.fn(),
  clearStoredHostToken: vi.fn(),
}));
vi.mock('@/lib/lobbyIdentity', () => ({
  persistLobbyIdentity: vi.fn(),
  getStoredLobbyMemberId: vi.fn(() => 'member-1'),
  getStoredLobbyNickname: vi.fn(() => 'Host'),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

const LOBBY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

describe('lobby API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createLobbySession persists lobby and session identity', async () => {
    rpcMock.mockResolvedValue({
      data: {
        lobby_id: LOBBY_ID,
        lobby_member_id: MEMBER_ID,
        session_id: SESSION_ID,
        host_token: 'host-secret',
        participant_id: PARTICIPANT_ID,
        claim_token: 'claim-1',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await createLobbySession({
      nickname: 'Host',
      durationMinutes: 12,
      workout: [{ name: 'Burpees', target: 10 }],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'create_lobby_session',
      expect.objectContaining({
        p_duration_minutes: 12,
        p_nickname: 'Host',
      })
    );
    expect(lobbyIdentity.persistLobbyIdentity).toHaveBeenCalledWith(LOBBY_ID, {
      memberId: MEMBER_ID,
      nickname: 'Host',
      sessionId: SESSION_ID,
    });
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.data?.lobbyId).toBe(LOBBY_ID);
  });

  it('joinLobby maps not-found errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Lobby not found' },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as never);

    const result = await joinLobby({ lobbyId: LOBBY_ID, nickname: 'Jules' });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Staging area not found.');
  });

  it('joinLobby persists rotated claim_token and session_state on reclaim', async () => {
    rpcMock.mockResolvedValue({
      data: {
        lobby_id: LOBBY_ID,
        lobby_member_id: MEMBER_ID,
        host_user_id: 'user-1',
        status: 'open',
        active_session_id: SESSION_ID,
        session_id: SESSION_ID,
        session_state: 'waiting',
        participant_id: PARTICIPANT_ID,
        nickname: 'Jules',
        role: 'joiner',
        claim_token: 'rotated-claim',
        host_token: null,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await joinLobby({ lobbyId: LOBBY_ID, nickname: 'Jules' });
    expect(result.error).toBeNull();
    expect(result.data?.sessionState).toBe('waiting');
    expect(result.data?.claimToken).toBe('rotated-claim');
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        participantId: PARTICIPANT_ID,
        claimToken: 'rotated-claim',
      })
    );
  });

  it('passLobbyCommand returns null host_token and clears the old host token', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        host_user_id: 'user-2',
        host_token: null,
        active_session_id: SESSION_ID,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await passLobbyCommand({ lobbyId: LOBBY_ID, toUserId: 'user-2' });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      hostUserId: 'user-2',
      hostToken: null,
      activeSessionId: SESSION_ID,
    });
    expect(sessionIdentity.clearStoredHostToken).toHaveBeenCalledWith(SESSION_ID);
  });

  it('startNextLobbySession seeds the new session identity', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        session_id: SESSION_ID,
        host_token: 'next-host',
        participant_id: PARTICIPANT_ID,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await startNextLobbySession({
      lobbyId: LOBBY_ID,
      durationMinutes: 10,
      workout: [{ name: 'Air Squats', target: 15 }],
      templateId: 'blood-shunt-10',
      intensityTier: 3,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'start_next_lobby_session',
      expect.objectContaining({
        p_template_id: 'blood-shunt-10',
        p_intensity_tier: 3,
      })
    );
    expect(result.error).toBeNull();
    expect(result.data?.sessionId).toBe(SESSION_ID);
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        hostToken: 'next-host',
        participantId: PARTICIPANT_ID,
      })
    );
  });
});
