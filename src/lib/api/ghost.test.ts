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
  it('passes forMissionId so makeup missions can load crew runs', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        personal_best: null,
        friends: [
          {
            mission_id: 'live-1',
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
      p_for_mission_id: 'makeup-sess',
      p_version_key: null,
    });
    expect(result.error).toBeNull();
    expect(result.data?.friends).toHaveLength(1);
    expect(result.data?.friends[0].nickname).toBe('Maya');
  });

  it('sends null forMissionId when omitted', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, personal_best: null, friends: [] },
      error: null,
    } as never);
    await fetchAvailableGhosts('the-valve', 10);
    expect(rpcMock).toHaveBeenCalledWith('available_ghosts', {
      p_template_id: 'the-valve',
      p_duration_minutes: 10,
      p_for_mission_id: null,
      p_version_key: null,
    });
  });

  it('asks for the athlete’s best run of the version they are about to do', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        personal_best: {
          mission_id: 'std-1',
          participant_id: 'p1',
          nickname: 'Justin',
          final_score: 62,
          base_score: 62,
          created_at: '2026-03-03T12:00:00.000Z',
        },
        variant_best: {
          mission_id: 'knees-1',
          participant_id: 'p2',
          nickname: 'Justin',
          final_score: 48,
          base_score: 48,
          created_at: '2026-02-20T12:00:00.000Z',
        },
        friends: [],
      },
      error: null,
    } as never);

    const result = await fetchAvailableGhosts(
      'the-valve',
      10,
      null,
      'Diamond Push-ups#push-up--knees'
    );

    expect(rpcMock).toHaveBeenCalledWith('available_ghosts', {
      p_template_id: 'the-valve',
      p_duration_minutes: 10,
      p_for_mission_id: null,
      p_version_key: 'Diamond Push-ups#push-up--knees',
    });
    // Both come back. The scaled best is the one they can chase; their own
    // standard best is not hidden from them.
    expect(result.data?.variantBest?.finalScore).toBe(48);
    expect(result.data?.personalBest?.finalScore).toBe(62);
  });

  it('sends no version key for a mission performed as programmed', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, personal_best: null, variant_best: null, friends: [] },
      error: null,
    } as never);

    await fetchAvailableGhosts('the-valve', 10, null, '');

    expect(rpcMock).toHaveBeenCalledWith(
      'available_ghosts',
      expect.objectContaining({ p_version_key: null })
    );
  });

  it('has no variant best when the athlete has never done it that way', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, personal_best: null, variant_best: null, friends: [] },
      error: null,
    } as never);

    const result = await fetchAvailableGhosts(
      'the-valve',
      10,
      null,
      'Diamond Push-ups#push-up--knees'
    );
    expect(result.data?.variantBest).toBeNull();
  });

  it('tolerates an older server that does not return variant_best', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, personal_best: null, friends: [] },
      error: null,
    } as never);

    const result = await fetchAvailableGhosts(
      'the-valve',
      10,
      null,
      'Diamond Push-ups#push-up--knees'
    );
    expect(result.error).toBeNull();
    expect(result.data?.variantBest).toBeNull();
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
