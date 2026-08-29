import { callRpc } from '@/lib/api/callRpc';

export interface CoachFeaturedSchedule {
  id: string;
  coachWorkoutId: string;
  workoutName: string;
  daysOfWeek: number[];
  timesLocal: string[];
  timezone: string;
  active: boolean;
  updatedAt: string;
}

export type FeaturedWodScheduleApiError = { message: string };

export interface FeaturedWodAttendee {
  nickname: string;
  role: 'host' | 'joiner';
  joinedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [];
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function mapScheduleError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to manage the featured WOD.';
  }
  if (message.includes('Not authorized')) {
    return 'Not authorized.';
  }
  if (message.includes('invalid_timezone')) {
    return 'Choose a recognized timezone from the list.';
  }
  return message;
}

function parseSchedule(row: Record<string, unknown>): CoachFeaturedSchedule | null {
  const id = readString(row.id);
  const coachWorkoutId = readString(row.coachWorkoutId);
  const workoutName = readString(row.workoutName);
  const timezone = readString(row.timezone);
  const updatedAt = readString(row.updatedAt);
  if (!id || !coachWorkoutId || !workoutName || !timezone || !updatedAt) {
    return null;
  }
  return {
    id,
    coachWorkoutId,
    workoutName,
    daysOfWeek: readNumberArray(row.daysOfWeek),
    timesLocal: readStringArray(row.timesLocal),
    timezone,
    active: row.active === true,
    updatedAt,
  };
}

export async function fetchCoachFeaturedSchedule(): Promise<{
  data: CoachFeaturedSchedule | null;
  error: FeaturedWodScheduleApiError | null;
}> {
  const { data, error } = await callRpc('coach_get_featured_schedule', {});

  if (error) {
    return { data: null, error: { message: mapScheduleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  if (!raw.schedule) {
    return { data: null, error: null };
  }

  const schedule = parseSchedule(asRecord(raw.schedule));
  if (!schedule) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { data: schedule, error: null };
}

export async function setCoachFeaturedSchedule(input: {
  coachWorkoutId: string;
  daysOfWeek: number[];
  timesLocal: string[];
  timezone: string;
}): Promise<{ data: CoachFeaturedSchedule | null; error: FeaturedWodScheduleApiError | null }> {
  const { data, error } = await callRpc('coach_set_featured_schedule', {
    p_coach_workout_id: input.coachWorkoutId,
    p_days_of_week: input.daysOfWeek,
    p_times_local: input.timesLocal,
    p_timezone: input.timezone,
  });

  if (error) {
    return { data: null, error: { message: mapScheduleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  // coach_set_featured_schedule doesn't return workoutName (it doesn't join
  // coach_workouts) — refetch so callers always get a fully-populated row.
  return fetchCoachFeaturedSchedule();
}

export async function pauseCoachFeaturedSchedule(): Promise<{
  data: boolean;
  error: FeaturedWodScheduleApiError | null;
}> {
  const { data, error } = await callRpc('coach_pause_featured_schedule', {});

  if (error) {
    return { data: false, error: { message: mapScheduleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: false, error: { message: 'No featured schedule to pause.' } };
  }

  return { data: true, error: null };
}

function parseAttendee(row: Record<string, unknown>): FeaturedWodAttendee | null {
  const nickname = readString(row.nickname);
  const joinedAt = readString(row.joined_at);
  const role = row.role === 'host' ? 'host' : row.role === 'joiner' ? 'joiner' : null;
  if (!nickname || !joinedAt || !role) {
    return null;
  }
  return { nickname, role, joinedAt };
}

export async function fetchCoachFeaturedWodAttendees(): Promise<{
  data: { sessionId: string | null; attendees: FeaturedWodAttendee[] } | null;
  error: FeaturedWodScheduleApiError | null;
}> {
  const { data, error } = await callRpc('coach_featured_wod_attendees', {});

  if (error) {
    return { data: null, error: { message: mapScheduleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees
        .map((row) => parseAttendee(asRecord(row)))
        .filter((a): a is FeaturedWodAttendee => a !== null)
    : [];

  return {
    data: { sessionId: readString(raw.sessionId), attendees },
    error: null,
  };
}

export async function deleteCoachFeaturedSchedule(): Promise<{
  data: boolean;
  error: FeaturedWodScheduleApiError | null;
}> {
  const { data, error } = await callRpc('coach_delete_featured_schedule', {});

  if (error) {
    return { data: false, error: { message: mapScheduleError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: false, error: { message: 'No featured schedule to delete.' } };
  }

  return { data: true, error: null };
}
