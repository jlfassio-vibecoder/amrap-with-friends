import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resumeMissionIdentity } from './resumeMissionIdentity';
import { supabase } from '@/lib/supabase';
import * as missionIdentity from '@/lib/missionIdentity';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/missionIdentity', () => ({
  persistMissionIdentity: vi.fn(),
}));

const rpcMock = vi.mocked(supabase.rpc);
const persistMock = vi.mocked(missionIdentity.persistMissionIdentity);

const MISSION_ID = '35191f02-7075-42a8-9881-143c91cb011b';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

describe('resumeMissionIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists identity when the account claimed the mission', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        participantId: PARTICIPANT_ID,
        nickname: 'Operator',
        role: 'host',
        hostToken: 'host-secret',
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await resumeMissionIdentity(MISSION_ID);

    expect(rpcMock).toHaveBeenCalledWith('resume_mission_identity', {
      p_mission_id: MISSION_ID,
    });
    expect(persistMock).toHaveBeenCalledWith(MISSION_ID, {
      participantId: PARTICIPANT_ID,
      nickname: 'Operator',
      hostToken: 'host-secret',
    });
    expect(result.error).toBeNull();
    expect(result.missing).toBe(false);
    expect(result.data).toEqual({
      participantId: PARTICIPANT_ID,
      nickname: 'Operator',
      role: 'host',
      hostToken: 'host-secret',
    });
  });

  it('returns missing when the mission was never claimed by this user', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'not_claimed' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await resumeMissionIdentity(MISSION_ID);

    expect(result.data).toBeNull();
    expect(result.missing).toBe(true);
    expect(result.error).toBeNull();
    expect(persistMock).not.toHaveBeenCalled();
  });
});
