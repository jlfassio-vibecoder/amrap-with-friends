import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fetchCurrentFeaturedWod, formatFeaturedWodTime } from './featuredWod';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

beforeEach(() => {
  callRpcMock.mockReset();
});

describe('fetchCurrentFeaturedWod', () => {
  it('returns null when nothing is featured', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, featured: null }, error: null });

    const result = await fetchCurrentFeaturedWod();

    expect(callRpcMock).toHaveBeenCalledWith('current_featured_wod', {});
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('parses a next-occurrence featured wod with no session yet', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        featured: {
          workoutName: 'Sunrise AMRAP',
          focus: 'Full body',
          durationMinutes: 20,
          intensityTier: 3,
          tags: ['functional fitness'],
          scheduledAt: '2026-09-01T13:00:00.000Z',
          sessionId: null,
          state: null,
        },
      },
      error: null,
    });

    const result = await fetchCurrentFeaturedWod();

    expect(result.error).toBeNull();
    expect(result.data?.workoutName).toBe('Sunrise AMRAP');
    expect(result.data?.sessionId).toBeNull();
    expect(result.data?.state).toBeNull();
  });

  it('parses a live, joinable featured wod', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        featured: {
          workoutName: 'Sunrise AMRAP',
          focus: null,
          durationMinutes: 20,
          intensityTier: 3,
          tags: [],
          scheduledAt: '2026-09-01T13:00:00.000Z',
          sessionId: '22222222-2222-4222-8222-222222222222',
          state: 'waiting',
        },
      },
      error: null,
    });

    const result = await fetchCurrentFeaturedWod();

    expect(result.data?.sessionId).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.data?.state).toBe('waiting');
  });

  it('maps RPC errors', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await fetchCurrentFeaturedWod();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('boom');
  });

  it('surfaces an error when featured payload fails validation', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, featured: { workoutName: 'Broken' } },
      error: null,
    });

    const result = await fetchCurrentFeaturedWod();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});

describe('formatFeaturedWodTime', () => {
  it('formats an ISO instant as a locale string', () => {
    const formatted = formatFeaturedWodTime('2026-09-01T13:00:00.000Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
