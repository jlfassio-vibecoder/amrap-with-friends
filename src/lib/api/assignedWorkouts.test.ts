import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignWorkout,
  dismissAssignedWorkout,
  fetchMyAssignedWorkouts,
  startAssignedWorkout,
} from './assignedWorkouts';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);
const TO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MISSION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WORKOUT = [{ name: 'Burpees', target: 12, unit: 'reps' }];

function ok(data: unknown) {
  rpcMock.mockResolvedValue({
    data,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  } as never);
}
function fail(message: string) {
  rpcMock.mockResolvedValue({
    data: null,
    error: { message },
    count: null,
    status: 400,
    statusText: 'Bad Request',
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('assignWorkout', () => {
  it('sends the workout with its template and intensity', async () => {
    ok({ ok: true });
    await assignWorkout({
      toUserId: TO,
      durationMinutes: 10,
      workout: WORKOUT,
      templateId: 'the-hemodynamic',
      intensityTier: 3,
      note: '  Try this one  ',
    });
    expect(rpcMock).toHaveBeenCalledWith('assign_workout', {
      p_to_user_id: TO,
      p_duration_minutes: 10,
      p_workout: WORKOUT,
      p_template_id: 'the-hemodynamic',
      p_intensity_tier: 3,
      p_note: 'Try this one',
    });
  });

  it('sends nulls rather than empty strings for the optional fields', async () => {
    ok({ ok: true });
    await assignWorkout({ toUserId: TO, durationMinutes: 10, workout: WORKOUT, note: '   ' });
    expect(rpcMock).toHaveBeenCalledWith(
      'assign_workout',
      expect.objectContaining({ p_template_id: null, p_intensity_tier: null, p_note: null })
    );
  });

  it('turns the reach refusal into copy the host can act on', async () => {
    fail('Pick a squad friend to send it to');
    const result = await assignWorkout({ toUserId: TO, durationMinutes: 10, workout: WORKOUT });
    expect(result.error?.message).toBe('Pick someone from your squad to send it to.');
  });

  it('explains the pending cap rather than repeating the raw error', async () => {
    fail('They have not picked up your last few workouts yet');
    const result = await assignWorkout({ toUserId: TO, durationMinutes: 10, workout: WORKOUT });
    expect(result.error?.message).toContain('catch up');
  });
});

describe('fetchMyAssignedWorkouts', () => {
  it('parses the rows the recipient sees', async () => {
    ok({
      ok: true,
      assigned_workouts: [
        {
          assigned_workout_id: ID,
          from_user_id: TO,
          from_nickname: 'Maya',
          duration_minutes: 10,
          workout: WORKOUT,
          template_id: 'the-hemodynamic',
          intensity_tier: 3,
          note: 'Try this one',
          created_at: '2026-09-01T10:00:00Z',
        },
      ],
    });
    const result = await fetchMyAssignedWorkouts();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      assignedWorkoutId: ID,
      fromNickname: 'Maya',
      durationMinutes: 10,
      note: 'Try this one',
    });
  });

  it('still names a sender who has no nickname', async () => {
    ok({
      ok: true,
      assigned_workouts: [
        {
          assigned_workout_id: ID,
          from_user_id: TO,
          from_nickname: null,
          duration_minutes: 10,
          workout: WORKOUT,
        },
      ],
    });
    const result = await fetchMyAssignedWorkouts();
    expect(result.data[0].fromNickname).toBe('A squad friend');
  });

  it('drops a row that is missing what it needs rather than rendering a blank', async () => {
    ok({ ok: true, assigned_workouts: [{ from_user_id: TO, duration_minutes: 10 }] });
    const result = await fetchMyAssignedWorkouts();
    expect(result.data).toEqual([]);
  });

  it('returns an empty list, not an error, when there are none', async () => {
    ok({ ok: true, assigned_workouts: [] });
    const result = await fetchMyAssignedWorkouts();
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });
});

describe('dismiss and start', () => {
  it('dismisses by id', async () => {
    ok({ ok: true });
    await dismissAssignedWorkout(ID);
    expect(rpcMock).toHaveBeenCalledWith('dismiss_assigned_workout', { p_assigned_workout_id: ID });
  });

  it('links a start to the mission that was created', async () => {
    ok({ ok: true });
    await startAssignedWorkout(ID, MISSION);
    expect(rpcMock).toHaveBeenCalledWith('start_assigned_workout', {
      p_assigned_workout_id: ID,
      p_mission_id: MISSION,
    });
  });

  it('reports a gone assignment in the recipient’s language', async () => {
    fail('That workout is not available');
    const result = await dismissAssignedWorkout(ID);
    expect(result.error?.message).toBe('That workout is no longer on your list.');
  });
});
