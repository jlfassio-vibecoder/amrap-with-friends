import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteCoachExercise,
  deleteCoachWorkout,
  fetchCoachExercises,
  fetchCoachWorkout,
  fetchCoachWorkouts,
  upsertCoachExercise,
  upsertCoachWorkout,
} from './coachWod';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

beforeEach(() => {
  callRpcMock.mockReset();
});

const VALID_EXERCISE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Toe Hook Traverse',
  instructions: ['Set up on wall', 'Hook toe over hold'],
  cues: ['Keep hips close'],
  tips: 'Great for grip endurance.',
  imagePath: 'coach-id/exercise-id.jpg',
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:00:00.000Z',
};

const VALID_WORKOUT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Crimp Conditioning',
  focus: 'Grip endurance',
  durationMinutes: 15,
  intensityTier: 4,
  movements: [
    { name: 'Toe Hook Traverse', target: 10, unit: 'reps', coachExerciseId: VALID_EXERCISE.id },
    { name: 'Dead Hang', target: 30, unit: 'seconds' },
  ],
  tags: ['rock climbing', 'grip'],
  notes: 'Scale hang time to ability.',
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:00:00.000Z',
};

describe('fetchCoachExercises', () => {
  it('wires the search param and parses exercises', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, exercises: [VALID_EXERCISE, { id: 'bad', name: null }] },
      error: null,
    });

    const result = await fetchCoachExercises('toe');

    expect(callRpcMock).toHaveBeenCalledWith('coach_list_exercises', { p_search: 'toe' });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].name).toBe('Toe Hook Traverse');
    expect(result.data?.[0].instructions).toEqual(['Set up on wall', 'Hook toe over hold']);
  });

  it('maps authentication errors', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Authentication required' } });

    const result = await fetchCoachExercises();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to manage coach workouts.');
  });
});

describe('upsertCoachExercise', () => {
  it('wires all params including a null id for creation', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, exercise: VALID_EXERCISE }, error: null });

    const result = await upsertCoachExercise({
      name: 'Toe Hook Traverse',
      instructions: ['Set up on wall', 'Hook toe over hold'],
      cues: ['Keep hips close'],
      tips: 'Great for grip endurance.',
      imagePath: 'coach-id/exercise-id.jpg',
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_upsert_exercise', {
      p_id: null,
      p_name: 'Toe Hook Traverse',
      p_instructions: ['Set up on wall', 'Hook toe over hold'],
      p_cues: ['Keep hips close'],
      p_tips: 'Great for grip endurance.',
      p_image_path: 'coach-id/exercise-id.jpg',
    });
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(VALID_EXERCISE.id);
  });

  it('maps a not-authorized error', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Not authorized' } });

    const result = await upsertCoachExercise({
      name: 'X',
      instructions: [],
      cues: [],
    });

    expect(result.error?.message).toBe('Not authorized.');
  });
});

describe('deleteCoachExercise', () => {
  it('wires the id and returns success', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await deleteCoachExercise(VALID_EXERCISE.id);

    expect(callRpcMock).toHaveBeenCalledWith('coach_delete_exercise', { p_id: VALID_EXERCISE.id });
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });

  it('surfaces the in-use rejection message from the RPC', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Exercise is used by a workout — remove it from that workout first' },
    });

    const result = await deleteCoachExercise(VALID_EXERCISE.id);

    expect(result.data).toBe(false);
    expect(result.error?.message).toContain('remove it from that workout first');
  });
});

describe('fetchCoachWorkouts', () => {
  it('wires search/tag params and parses summaries', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        workouts: [
          {
            id: VALID_WORKOUT.id,
            name: VALID_WORKOUT.name,
            focus: VALID_WORKOUT.focus,
            durationMinutes: 15,
            intensityTier: 4,
            tags: VALID_WORKOUT.tags,
            movementCount: 2,
            updatedAt: VALID_WORKOUT.updatedAt,
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachWorkouts({ search: 'crimp', tag: 'rock climbing' });

    expect(callRpcMock).toHaveBeenCalledWith('coach_list_workouts', {
      p_search: 'crimp',
      p_tag: 'rock climbing',
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].movementCount).toBe(2);
  });
});

describe('fetchCoachWorkout', () => {
  it('parses a full workout including linked coachExerciseId', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, workout: VALID_WORKOUT },
      error: null,
    });

    const result = await fetchCoachWorkout(VALID_WORKOUT.id);

    expect(result.error).toBeNull();
    expect(result.data?.movements[0].coachExerciseId).toBe(VALID_EXERCISE.id);
    expect(result.data?.movements[1].coachExerciseId).toBeUndefined();
  });

  it('returns an error when the workout is not found', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: false }, error: null });

    const result = await fetchCoachWorkout('missing-id');

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Workout not found.');
  });
});

describe('upsertCoachWorkout', () => {
  it('wires all params', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true, workout: VALID_WORKOUT }, error: null });

    const result = await upsertCoachWorkout({
      name: 'Crimp Conditioning',
      focus: 'Grip endurance',
      durationMinutes: 15,
      intensityTier: 4,
      movements: [{ name: 'Dead Hang', target: 30, unit: 'seconds' }],
      tags: ['rock climbing'],
      notes: 'Scale hang time to ability.',
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_upsert_workout', {
      p_id: null,
      p_name: 'Crimp Conditioning',
      p_focus: 'Grip endurance',
      p_duration_minutes: 15,
      p_intensity_tier: 4,
      p_movements: [{ name: 'Dead Hang', target: 30, unit: 'seconds' }],
      p_tags: ['rock climbing'],
      p_notes: 'Scale hang time to ability.',
    });
    expect(result.error).toBeNull();
    expect(result.data?.name).toBe('Crimp Conditioning');
  });
});

describe('deleteCoachWorkout', () => {
  it('wires the id and returns success', async () => {
    callRpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await deleteCoachWorkout(VALID_WORKOUT.id);

    expect(callRpcMock).toHaveBeenCalledWith('coach_delete_workout', { p_id: VALID_WORKOUT.id });
    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });
});
