import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHostScheduledSessions,
  formatHostScheduledSessionRallyTime,
  formatHostScheduledSessionState,
  formatHostScheduledSessionWorkout,
} from './hostScheduledSessions';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  rpcMock.mockReset();
});

describe('hostScheduledSessions formatters', () => {
  it('formatHostScheduledSessionWorkout summarizes workout names', () => {
    expect(formatHostScheduledSessionWorkout([])).toBe('Workout');
    expect(
      formatHostScheduledSessionWorkout([{ name: 'Burpees', target: 20, unit: 'reps' }])
    ).toBe('Burpees');
    expect(
      formatHostScheduledSessionWorkout([
        { name: 'Burpees', target: 20, unit: 'reps' },
        { name: 'Air squats', target: 20, unit: 'reps' },
      ])
    ).toBe('Burpees + 1 more');
  });

  it('formatHostScheduledSessionRallyTime uses locale string', () => {
    const label = formatHostScheduledSessionRallyTime('2026-08-25T23:30:00.000Z');
    expect(label.length).toBeGreaterThan(0);
  });

  it('formatHostScheduledSessionState maps known phases', () => {
    expect(formatHostScheduledSessionState('waiting')).toBe('Waiting');
    expect(formatHostScheduledSessionState('setup')).toBe('Get ready');
    expect(formatHostScheduledSessionState('work')).toBe('Work');
    expect(formatHostScheduledSessionState('custom')).toBe('custom');
  });
});

describe('fetchHostScheduledSessions', () => {
  it('maps RPC sessions into entries', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        sessions: [
          {
            session_id: '22222222-2222-4222-8222-222222222222',
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

    const result = await fetchHostScheduledSessions();

    expect(rpcMock).toHaveBeenCalledWith('host_scheduled_sessions');
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
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

    const result = await fetchHostScheduledSessions();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Authentication required');
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

    const result = await fetchHostScheduledSessions();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});
