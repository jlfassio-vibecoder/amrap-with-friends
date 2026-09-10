import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  fetchSmartRecoveryHistory,
  parseSmartRecoveryHistoryEntry,
  parseSmartRecoveryHistoryPayload,
} from './smartRecovery';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  getSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
});

describe('parseSmartRecoveryHistoryEntry', () => {
  it('parses a valid completion row', () => {
    expect(
      parseSmartRecoveryHistoryEntry({
        template_id: 'the-piston',
        intensity_tier: 4,
        completed_at: '2026-08-24T10:00:00.000Z',
      })
    ).toEqual({
      templateId: 'the-piston',
      intensityTier: 4,
      completedAt: '2026-08-24T10:00:00.000Z',
    });
  });

  it('maps null template_id to null', () => {
    expect(
      parseSmartRecoveryHistoryEntry({
        template_id: null,
        intensity_tier: 2,
        completed_at: '2026-08-20T18:30:00.000Z',
      })
    ).toEqual({
      templateId: null,
      intensityTier: 2,
      completedAt: '2026-08-20T18:30:00.000Z',
    });
  });

  it('passes through coach template ids', () => {
    expect(
      parseSmartRecoveryHistoryEntry({
        template_id: 'coach:550e8400-e29b-41d4-a716-446655440000',
        intensity_tier: 5,
        completed_at: '2026-08-24T10:00:00.000Z',
      })?.templateId
    ).toBe('coach:550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects invalid intensity_tier', () => {
    expect(
      parseSmartRecoveryHistoryEntry({
        template_id: 'the-piston',
        intensity_tier: 6,
        completed_at: '2026-08-24T10:00:00.000Z',
      })
    ).toBeNull();
  });
});

describe('parseSmartRecoveryHistoryPayload', () => {
  it('parses empty completions', () => {
    expect(parseSmartRecoveryHistoryPayload({ completions: [] })).toEqual({
      completions: [],
    });
  });

  it('drops malformed rows', () => {
    expect(
      parseSmartRecoveryHistoryPayload({
        completions: [
          {
            template_id: 'the-piston',
            intensity_tier: 4,
            completed_at: '2026-08-24T10:00:00.000Z',
          },
          {
            template_id: 'bad',
            intensity_tier: 0,
            completed_at: '2026-08-24T10:00:00.000Z',
          },
        ],
      })
    ).toEqual({
      completions: [
        {
          templateId: 'the-piston',
          intensityTier: 4,
          completedAt: '2026-08-24T10:00:00.000Z',
        },
      ],
    });
  });

  it('rejects non-array completions', () => {
    expect(parseSmartRecoveryHistoryPayload({ completions: null })).toBeNull();
  });
});

describe('fetchSmartRecoveryHistory', () => {
  it('calls smart_recovery_history with no params', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        completions: [
          {
            template_id: 'the-piston',
            intensity_tier: 4,
            completed_at: '2026-08-24T10:00:00.000Z',
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchSmartRecoveryHistory();

    expect(rpcMock).toHaveBeenCalledWith('smart_recovery_history', {});
    expect(result.error).toBeNull();
    expect(result.data?.completions).toHaveLength(1);
    expect(result.data?.completions[0].templateId).toBe('the-piston');
  });

  it('maps authentication errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Authentication required' },
    } as never);

    const result = await fetchSmartRecoveryHistory();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to use Smart Recovery.');
  });

  it('returns an error when ok is false', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false },
      error: null,
    } as never);

    const result = await fetchSmartRecoveryHistory();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});
