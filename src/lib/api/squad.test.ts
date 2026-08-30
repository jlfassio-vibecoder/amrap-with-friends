import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  acceptSquadInviteCode,
  fetchMySquad,
  fetchSquadInvitePreview,
  searchAthletes,
  sendSquadInvite,
} from './squad';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  getSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
});

describe('fetchMySquad', () => {
  it('parses friends, pending, and the invite code', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        invite_code: 'ABC123XYZ0',
        friend_limit: 50,
        friends: [{ user_id: 'u2', username: 'jules', nickname: 'Jules' }],
        incoming: [{ user_id: 'u3', username: 'rico', nickname: 'Rico', request_id: 'r1' }],
        outgoing: [{ user_id: 'u4', username: 'sam', nickname: 'Sam', request_id: 'r2' }],
      },
      error: null,
    } as never);

    const result = await fetchMySquad();
    expect(result.error).toBeNull();
    expect(result.data?.inviteCode).toBe('ABC123XYZ0');
    expect(result.data?.friends).toEqual([{ userId: 'u2', username: 'jules', nickname: 'Jules' }]);
    expect(result.data?.incoming[0]?.requestId).toBe('r1');
    expect(result.data?.outgoing[0]?.userId).toBe('u4');
  });

  it('translates the intake gate', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Intake required' },
    } as never);
    const result = await fetchMySquad();
    expect(result.error?.message).toBe(
      'Complete your profile before inviting people to your squad.'
    );
  });
});

describe('searchAthletes', () => {
  it('does not call the RPC for a query shorter than three characters', async () => {
    const result = await searchAthletes('  ab  ');
    expect(result.data).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('parses search hits and their status', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        athletes: [
          { user_id: 'u2', username: 'jules', nickname: 'Jules', status: 'none' },
          { user_id: 'u3', username: 'rico', nickname: 'Rico', status: 'friends' },
        ],
      },
      error: null,
    } as never);
    const result = await searchAthletes('jul');
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { userId: 'u2', username: 'jules', nickname: 'Jules', status: 'none' },
      { userId: 'u3', username: 'rico', nickname: 'Rico', status: 'friends' },
    ]);
    expect(rpcMock).toHaveBeenCalledWith('search_athletes', { p_query: 'jul' });
  });
});

describe('sendSquadInvite', () => {
  it('maps already-friends into copy', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Already friends' },
    } as never);
    const result = await sendSquadInvite('u2');
    expect(result.error?.message).toBe("You are already on each other's squad.");
  });
});

describe('fetchSquadInvitePreview', () => {
  it('rejects an empty code without calling the RPC', async () => {
    const result = await fetchSquadInvitePreview('   ');
    expect(result.error?.message).toBe('That invite link is not valid.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps a missing invite', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Invite not found' },
    } as never);
    const result = await fetchSquadInvitePreview('NOPE');
    expect(result.error?.message).toBe('That invite is not available.');
  });

  it('parses the inviter name', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, username: 'maya', nickname: 'Maya' },
      error: null,
    } as never);
    const result = await fetchSquadInvitePreview('ABC123');
    expect(result.data).toEqual({ username: 'maya', nickname: 'Maya' });
  });
});

describe('acceptSquadInviteCode', () => {
  it('sends the trimmed code', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null } as never);
    const result = await acceptSquadInviteCode('  ABC123  ');
    expect(result.error).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith('accept_squad_invite_code', {
      p_invite_code: 'ABC123',
    });
  });
});
