import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  deleteCoachFeaturedSchedule,
  fetchCoachFeaturedSchedule,
  fetchCoachFeaturedWodAttendees,
  pauseCoachFeaturedSchedule,
  setCoachFeaturedSchedule,
} from './featuredWodSchedule';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

const VALID_SCHEDULE = {
  id: '11111111-1111-4111-8111-111111111111',
  coachWorkoutId: '22222222-2222-4222-8222-222222222222',
  workoutName: 'Sunrise AMRAP',
  daysOfWeek: [1, 3, 5],
  timesLocal: ['06:00', '18:00'],
  timezone: 'America/Los_Angeles',
  active: true,
  updatedAt: '2026-08-31T10:00:00.000Z',
};

beforeEach(() => {
  callRpcMock.mockReset();
});

describe('fetchCoachFeaturedSchedule', () => {
  it('returns null when the coach has no schedule', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, schedule: null }, error: null });

    const result = await fetchCoachFeaturedSchedule();

    expect(callRpcMock).toHaveBeenCalledWith('coach_get_featured_schedule', {});
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('parses an existing schedule', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, schedule: VALID_SCHEDULE }, error: null });

    const result = await fetchCoachFeaturedSchedule();

    expect(result.error).toBeNull();
    expect(result.data?.workoutName).toBe('Sunrise AMRAP');
    expect(result.data?.daysOfWeek).toEqual([1, 3, 5]);
    expect(result.data?.timesLocal).toEqual(['06:00', '18:00']);
  });

  it('maps an authentication error', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Authentication required' } });

    const result = await fetchCoachFeaturedSchedule();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to manage the featured WOD.');
  });

  it('surfaces an error when schedule payload fails validation', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, schedule: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });

    const result = await fetchCoachFeaturedSchedule();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});

describe('setCoachFeaturedSchedule', () => {
  it('wires params and refetches the fully-populated schedule', async () => {
    callRpcMock
      .mockResolvedValueOnce({ data: { ok: true, schedule: {} }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, schedule: VALID_SCHEDULE }, error: null });

    const result = await setCoachFeaturedSchedule({
      coachWorkoutId: '22222222-2222-4222-8222-222222222222',
      daysOfWeek: [1, 3, 5],
      timesLocal: ['06:00', '18:00'],
      timezone: 'America/Los_Angeles',
    });

    expect(callRpcMock).toHaveBeenNthCalledWith(1, 'coach_set_featured_schedule', {
      p_coach_workout_id: '22222222-2222-4222-8222-222222222222',
      p_days_of_week: [1, 3, 5],
      p_times_local: ['06:00', '18:00'],
      p_timezone: 'America/Los_Angeles',
    });
    expect(callRpcMock).toHaveBeenNthCalledWith(2, 'coach_get_featured_schedule', {});
    expect(result.error).toBeNull();
    expect(result.data?.workoutName).toBe('Sunrise AMRAP');
  });

  it('surfaces the one-active-schedule conflict message', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'A featured WOD is already scheduled by another coach. Ask them to pause it first.',
      },
    });

    const result = await setCoachFeaturedSchedule({
      coachWorkoutId: '22222222-2222-4222-8222-222222222222',
      daysOfWeek: [1],
      timesLocal: ['06:00'],
      timezone: 'UTC',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('already scheduled by another coach');
  });

  it('maps an invalid_timezone error to a friendly message', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'invalid_timezone' },
    });

    const result = await setCoachFeaturedSchedule({
      coachWorkoutId: '22222222-2222-4222-8222-222222222222',
      daysOfWeek: [1],
      timesLocal: ['06:00'],
      timezone: 'Not/AZone',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Choose a recognized timezone from the list.');
  });
});

describe('pauseCoachFeaturedSchedule', () => {
  it('wires the call and returns success', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await pauseCoachFeaturedSchedule();

    expect(callRpcMock).toHaveBeenCalledWith('coach_pause_featured_schedule', {});
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns an error when there is nothing to pause', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: false, reason: 'not_found' }, error: null });

    const result = await pauseCoachFeaturedSchedule();

    expect(result.data).toBe(false);
    expect(result.error?.message).toContain('No featured schedule');
  });
});

describe('fetchCoachFeaturedWodAttendees', () => {
  it('returns an empty list and null sessionId when nothing is live', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, sessionId: null, attendees: [] },
      error: null,
    });

    const result = await fetchCoachFeaturedWodAttendees();

    expect(callRpcMock).toHaveBeenCalledWith('coach_featured_wod_attendees', {});
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ sessionId: null, attendees: [] });
  });

  it('parses attendee rows for a live session', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        sessionId: '33333333-3333-4333-8333-333333333333',
        attendees: [
          { nickname: 'Coach', role: 'host', joined_at: '2026-08-31T10:00:00.000Z' },
          { nickname: 'Alice', role: 'joiner', joined_at: '2026-08-31T10:01:00.000Z' },
        ],
      },
      error: null,
    });

    const result = await fetchCoachFeaturedWodAttendees();

    expect(result.error).toBeNull();
    expect(result.data?.sessionId).toBe('33333333-3333-4333-8333-333333333333');
    expect(result.data?.attendees).toEqual([
      { nickname: 'Coach', role: 'host', joinedAt: '2026-08-31T10:00:00.000Z' },
      { nickname: 'Alice', role: 'joiner', joinedAt: '2026-08-31T10:01:00.000Z' },
    ]);
  });

  it('drops malformed attendee rows rather than throwing', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        sessionId: '33333333-3333-4333-8333-333333333333',
        attendees: [{ nickname: '', role: 'joiner', joined_at: '2026-08-31T10:01:00.000Z' }],
      },
      error: null,
    });

    const result = await fetchCoachFeaturedWodAttendees();

    expect(result.data?.attendees).toEqual([]);
  });

  it('maps an authentication error', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Authentication required' } });

    const result = await fetchCoachFeaturedWodAttendees();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to manage the featured WOD.');
  });
});

describe('deleteCoachFeaturedSchedule', () => {
  it('wires the call and returns success', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await deleteCoachFeaturedSchedule();

    expect(callRpcMock).toHaveBeenCalledWith('coach_delete_featured_schedule', {});
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });
});
