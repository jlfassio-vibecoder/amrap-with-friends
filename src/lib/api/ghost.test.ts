import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { fetchAvailableGhosts, fetchGhostCurveData } from './ghost';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  getSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
});

describe('fetchAvailableGhosts', () => {
  it('passes forSessionId so makeup sessions can load crew runs', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        personal_best: null,
        friends: [
          {
            session_id: 'live-1',
            participant_id: 'p1',
            nickname: 'Maya',
            final_score: 90,
            base_score: 80,
            created_at: '2026-10-05T12:00:00.000Z',
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchAvailableGhosts('the-valve', 10, 'makeup-sess');
    expect(rpcMock).toHaveBeenCalledWith('available_ghosts', {
      p_template_id: 'the-valve',
      p_duration_minutes: 10,
      p_for_session_id: 'makeup-sess',
    });
    expect(result.error).toBeNull();
    expect(result.data?.friends).toHaveLength(1);
    expect(result.data?.friends[0].nickname).toBe('Maya');
  });

  it('sends null forSessionId when omitted', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, personal_best: null, friends: [] },
      error: null,
    } as never);
    await fetchAvailableGhosts('the-valve', 10);
    expect(rpcMock).toHaveBeenCalledWith('available_ghosts', {
      p_template_id: 'the-valve',
      p_duration_minutes: 10,
      p_for_session_id: null,
    });
  });
});

describe('fetchGhostCurveData', () => {
  it('maps forbidden to a clear access error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'forbidden' },
      error: null,
    } as never);
    const result = await fetchGhostCurveData('s1', 'p1');
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('You cannot access this ghost run.');
  });
});
