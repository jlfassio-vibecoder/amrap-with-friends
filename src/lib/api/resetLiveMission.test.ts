import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapResetLiveMissionError, resetLiveMission } from './resetLiveMission';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const NEW_MISSION_ID = '44444444-4444-4444-8444-444444444444';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

describe('mapResetLiveMissionError', () => {
  it('maps featured, campaign, scored, and host failures', () => {
    expect(mapResetLiveMissionError('Featured missions cannot be reset')).toBe(
      'Featured missions cannot be reset.'
    );
    expect(mapResetLiveMissionError('Campaign missions cannot be reset')).toBe(
      'Campaign missions cannot be reset.'
    );
    expect(mapResetLiveMissionError('Completed missions cannot be reset')).toBe(
      'This mission already has a locked score and cannot be reset.'
    );
    expect(mapResetLiveMissionError('Invalid host token')).toBe(
      'Only the host can reset this mission.'
    );
    expect(mapResetLiveMissionError('Mission cannot be reset in this state')).toBe(
      'This mission cannot be reset right now.'
    );
  });
});

describe('resetLiveMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        mission_id: NEW_MISSION_ID,
        host_token: 'new-host',
        participant_id: PARTICIPANT_ID,
        claim_token: 'new-claim',
        rally_point_id: null,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await resetLiveMission({
      missionId: MISSION_ID,
      hostToken: 'old-host',
    });

    expect(rpcMock).toHaveBeenCalledWith('reset_live_mission', {
      p_mission_id: MISSION_ID,
      p_host_token: 'old-host',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      missionId: NEW_MISSION_ID,
      hostToken: 'new-host',
      participantId: PARTICIPANT_ID,
      claimToken: 'new-claim',
      rallyPointId: null,
    });
  });

  it('maps RPC exceptions', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Featured missions cannot be reset',
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
      success: false,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await resetLiveMission({
      missionId: MISSION_ID,
      hostToken: 'old-host',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Featured missions cannot be reset.');
  });
});
