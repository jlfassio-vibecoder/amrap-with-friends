import { callRpc } from '@/lib/api/callRpc';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import { getSupabaseClient } from '@/lib/supabase';

export interface HostScheduledSessionEntry {
  sessionId: string;
  scheduledAt: string;
  createdAt: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  state: string;
}

export type HostScheduledSessionsApiError = {
  message: string;
};

function readWorkout(value: unknown): WorkoutExercise[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as WorkoutExercise[];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseHostScheduledSessionEntry(
  raw: unknown
): HostScheduledSessionEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const sessionId = readString(row.session_id);
  const scheduledAt = readString(row.scheduled_at);
  const createdAt = readString(row.created_at);
  const durationMinutes = readNumber(row.duration_minutes);
  const state = readString(row.state);

  if (
    !sessionId ||
    !scheduledAt ||
    !createdAt ||
    durationMinutes === null ||
    !state
  ) {
    return null;
  }

  return {
    sessionId,
    scheduledAt,
    createdAt,
    durationMinutes,
    workout: readWorkout(row.workout),
    state,
  };
}

export function formatHostScheduledSessionWorkout(
  workout: WorkoutExercise[]
): string {
  if (workout.length === 0) {
    return 'Workout';
  }
  const first = workout[0].name;
  if (workout.length === 1) {
    return first;
  }
  return `${first} + ${workout.length - 1} more`;
}

export function formatHostScheduledSessionRallyTime(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatHostScheduledSessionState(state: string): string {
  switch (state) {
    case 'waiting':
      return 'Waiting';
    case 'setup':
      return 'Get ready';
    case 'work':
      return 'Work';
    default:
      return state;
  }
}

export async function fetchHostScheduledSessions(): Promise<{
  data: HostScheduledSessionEntry[] | null;
  error: HostScheduledSessionsApiError | null;
}> {
  // This RPC is granted to `authenticated` only. Calling it with the anon key
  // (no user JWT) returns HTTP 401 — avoid the request when the session is gone.
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) {
    return {
      data: null,
      error: { message: 'Sign in to see your scheduled rallies.' },
    };
  }

  const { data, error } = await callRpc('host_scheduled_sessions');

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('jwt') ||
      message.includes('permission denied') ||
      message.includes('not authenticated') ||
      message.includes('authentication required')
    ) {
      return {
        data: null,
        error: { message: 'Sign in again to see your scheduled rallies.' },
      };
    }
    return { data: null, error: { message: error.message } };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const entries = sessions
    .map((session) => parseHostScheduledSessionEntry(session))
    .filter((entry): entry is HostScheduledSessionEntry => entry !== null);

  return { data: entries, error: null };
}
