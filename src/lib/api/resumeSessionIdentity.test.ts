import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resumeSessionIdentity } from './resumeSessionIdentity';
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

const SESSION_ID = '35191f02-7075-42a8-9881-143c91cb011b';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

describe('resumeSessionIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists identity when the account claimed the session', async () => {
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

    const result = await resumeSessionIdentity(SESSION_ID);

    expect(rpcMock).toHaveBeenCalledWith('resume_session_identity', {
      p_session_id: SESSION_ID,
    });
    expect(persistMock).toHaveBeenCalledWith(SESSION_ID, {
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

  it('returns missing when the session was never claimed by this user', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'not_claimed' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await resumeSessionIdentity(SESSION_ID);

    expect(result.data).toBeNull();
    expect(result.missing).toBe(true);
    expect(result.error).toBeNull();
    expect(persistMock).not.toHaveBeenCalled();
  });
});
