import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimParticipant } from './claimParticipant';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';

describe('claimParticipant API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls claim_participant RPC and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        participant_id: PARTICIPANT_ID,
        mission_id: MISSION_ID,
        user_id: USER_ID,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await claimParticipant({
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
    });

    expect(rpcMock).toHaveBeenCalledWith('claim_participant', {
      p_participant_id: PARTICIPANT_ID,
      p_claim_token: 'claim-token',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      participantId: PARTICIPANT_ID,
      missionId: MISSION_ID,
      userId: USER_ID,
      alreadyClaimed: false,
    });
  });

  it('parses already_claimed idempotent success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        already_claimed: true,
        participant_id: PARTICIPANT_ID,
        mission_id: MISSION_ID,
        user_id: USER_ID,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await claimParticipant({
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
    });

    expect(result.data?.ok).toBe(true);
    if (result.data?.ok) {
      expect(result.data.alreadyClaimed).toBe(true);
    }
  });

  it('parses invalid_claim_token without throwing', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_claim_token' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await claimParticipant({
      participantId: PARTICIPANT_ID,
      claimToken: 'wrong',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'invalid_claim_token' });
  });
});
