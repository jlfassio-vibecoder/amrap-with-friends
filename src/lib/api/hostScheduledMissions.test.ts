import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHostScheduledMissions,
  formatHostScheduledMissionRallyTime,
  formatHostScheduledMissionState,
  formatHostScheduledMissionWorkout,
} from './hostScheduledMissions';
import { getSupabaseClient, supabase } from '@/lib/supabase';

const getSessionMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  })),
}));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: 'test-access-token' } },
  });
  vi.mocked(getSupabaseClient).mockClear();
});

describe('hostScheduledMissions formatters', () => {
  it('formatHostScheduledMissionWorkout summarizes workout names', () => {
    expect(formatHostScheduledMissionWorkout([])).toBe('Workout');
    expect(formatHostScheduledMissionWorkout([{ name: 'Burpees', target: 20, unit: 'reps' }])).toBe(
      'Burpees'
    );
    expect(
      formatHostScheduledMissionWorkout([
        { name: 'Burpees', target: 20, unit: 'reps' },
        { name: 'Air squats', target: 20, unit: 'reps' },
      ])
    ).toBe('Burpees + 1 more');
  });

  it('formatHostScheduledMissionRallyTime uses locale string', () => {
    const label = formatHostScheduledMissionRallyTime('2026-08-25T23:30:00.000Z');
    expect(label.length).toBeGreaterThan(0);
  });

  it('formatHostScheduledMissionState maps known phases', () => {
    expect(formatHostScheduledMissionState('waiting')).toBe('Waiting');
    expect(formatHostScheduledMissionState('setup')).toBe('Get ready');
    expect(formatHostScheduledMissionState('work')).toBe('Work');
    expect(formatHostScheduledMissionState('custom')).toBe('custom');
  });
});

describe('fetchHostScheduledMissions', () => {
  it('maps RPC missions into entries', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        missions: [
          {
            mission_id: '22222222-2222-4222-8222-222222222222',
            scheduled_at: '2026-08-25T23:30:00.000Z',
            created_at: '2026-08-25T12:00:00.000Z',
            duration_minutes: 5,
            workout: [{ name: 'Burpees', target: 20, unit: 'reps' }],
            state: 'waiting',
          },
        ],
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });

    const result = await fetchHostScheduledMissions();

    expect(rpcMock).toHaveBeenCalledWith('host_scheduled_missions', {});
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        missionId: '22222222-2222-4222-8222-222222222222',
        scheduledAt: '2026-08-25T23:30:00.000Z',
        createdAt: '2026-08-25T12:00:00.000Z',
        durationMinutes: 5,
        workout: [{ name: 'Burpees', target: 20, unit: 'reps' }],
        state: 'waiting',
      },
    ]);
  });

  it('returns RPC error message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Authentication required',
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
      count: null,
      status: 401,
      statusText: 'Unauthorized',
      success: false,
    });

    const result = await fetchHostScheduledMissions();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in again to see your scheduled rallies.');
  });

  it('skips the RPC when there is no access token', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const result = await fetchHostScheduledMissions();

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to see your scheduled rallies.');
  });

  it('returns generic error when ok is false', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });

    const result = await fetchHostScheduledMissions();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});
