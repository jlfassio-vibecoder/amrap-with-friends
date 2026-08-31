import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';

export type AssignedWorkoutApiError = { message: string };

export interface AssignedWorkout {
  assignedWorkoutId: string;
  fromUserId: string;
  fromNickname: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId: string | null;
  intensityTier: number | null;
  note: string | null;
  createdAt: string;
}

const ERROR_COPY: Record<string, string> = {
  'Authentication required': 'Sign in to send a workout.',
  'Intake required': 'Complete your profile before sending a workout.',
  'Pick a squad friend to send it to': 'Pick someone from your squad to send it to.',
  'They have not picked up your last few workouts yet':
    'They have not picked up your last few workouts yet. Give them a chance to catch up.',
  'Invalid workout format': 'That workout could not be sent. Try picking it again.',
  'Duration must be between 1 and 60 minutes': 'Pick a duration between 1 and 60 minutes.',
  'Keep the note to 200 characters or fewer': 'Keep the note to 200 characters or fewer.',
  'That workout is not available': 'That workout is no longer on your list.',
};

function mapError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  for (const [needle, copy] of Object.entries(ERROR_COPY)) {
    if (message.includes(needle)) {
      return copy;
    }
  }
  return message;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseAssignedWorkout(raw: unknown): AssignedWorkout | null {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const assignedWorkoutId = readString(row.assigned_workout_id);
  const fromUserId = readString(row.from_user_id);
  const durationMinutes = readNumber(row.duration_minutes);
  if (!assignedWorkoutId || !fromUserId || durationMinutes === null) {
    return null;
  }
  return {
    assignedWorkoutId,
    fromUserId,
    // A sender with no profile nickname is still worth showing as *someone*.
    fromNickname: readString(row.from_nickname) ?? 'A squad friend',
    durationMinutes,
    workout: Array.isArray(row.workout) ? (row.workout as WorkoutExercise[]) : [],
    templateId: readString(row.template_id),
    intensityTier: readNumber(row.intensity_tier),
    note: readString(row.note),
    createdAt: readString(row.created_at) ?? '',
  };
}

/**
 * Puts a workout on a squad friend's My sessions page. Reach is enforced in
 * Postgres against squad_friends — this only shapes the call.
 */
export async function assignWorkout(input: {
  toUserId: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  templateId?: string | null;
  intensityTier?: number | null;
  note?: string | null;
}): Promise<{ error: AssignedWorkoutApiError | null }> {
  const { error } = await callRpc('assign_workout', {
    p_to_user_id: input.toUserId,
    p_duration_minutes: input.durationMinutes,
    p_workout: input.workout,
    p_template_id: input.templateId ?? null,
    p_intensity_tier: input.intensityTier ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

/** Workouts waiting for the signed-in athlete. Pending only. */
export async function fetchMyAssignedWorkouts(): Promise<{
  data: AssignedWorkout[];
  error: AssignedWorkoutApiError | null;
}> {
  const { data, error } = await callRpc('my_assigned_workouts');
  if (error) {
    return { data: [], error: { message: mapError(error.message) } };
  }
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const rows = Array.isArray(root.assigned_workouts) ? root.assigned_workouts : [];
  return {
    data: rows
      .map(parseAssignedWorkout)
      .filter((entry): entry is AssignedWorkout => entry !== null),
    error: null,
  };
}

export async function dismissAssignedWorkout(
  assignedWorkoutId: string
): Promise<{ error: AssignedWorkoutApiError | null }> {
  const { error } = await callRpc('dismiss_assigned_workout', {
    p_assigned_workout_id: assignedWorkoutId,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}

/**
 * Marks one started once the athlete has created the session from it. Called
 * after create_session so the row can link to what they actually ran.
 */
export async function startAssignedWorkout(
  assignedWorkoutId: string,
  sessionId: string
): Promise<{ error: AssignedWorkoutApiError | null }> {
  const { error } = await callRpc('start_assigned_workout', {
    p_assigned_workout_id: assignedWorkoutId,
    p_session_id: sessionId,
  });
  if (error) {
    return { error: { message: mapError(error.message) } };
  }
  return { error: null };
}
