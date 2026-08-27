import { callRpc } from '@/lib/api/callRpc';

export type CoachWodApiError = { message: string };

export interface CoachExercisePhoto {
  path: string;
  caption?: string;
}

export interface CoachExercise {
  id: string;
  name: string;
  instructions: string[];
  cues: string[];
  tips: string | null;
  photos: CoachExercisePhoto[];
  isShared: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachWorkoutMovement {
  name: string;
  target?: number;
  unit?: string;
  coachExerciseId?: string;
}

export type CoachWorkoutStatus = 'draft' | 'published';

export interface CoachWorkoutSummary {
  id: string;
  name: string;
  focus: string | null;
  durationMinutes: number;
  intensityTier: number;
  tags: string[];
  movementCount: number;
  isLocked: boolean;
  status: CoachWorkoutStatus;
  isShared: boolean;
  isOwner: boolean;
  updatedAt: string;
}

export interface CoachWorkout {
  id: string;
  name: string;
  focus: string | null;
  durationMinutes: number;
  intensityTier: number;
  movements: CoachWorkoutMovement[];
  tags: string[];
  notes: string | null;
  isLocked: boolean;
  status: CoachWorkoutStatus;
  isShared: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A movement from a published workout, with any linked exercise's detail
 * inlined so a non-coach user can render "How to" without a coach-only call. */
export interface PublishedCoachWorkoutMovement {
  name: string;
  target?: number;
  unit?: string;
  exercise: {
    id: string;
    name: string;
    instructions: string[];
    cues: string[];
    tips: string | null;
    photos: CoachExercisePhoto[];
  } | null;
}

export interface PublishedCoachWorkout {
  id: string;
  name: string;
  focus: string | null;
  durationMinutes: number;
  intensityTier: number;
  tags: string[];
  notes: string | null;
  movements: PublishedCoachWorkoutMovement[];
  updatedAt: string;
}

export interface CoachWorkoutHistoryEntry {
  sessionId: string;
  nickname: string;
  role: string;
  state: string;
  finalScore: number | null;
  createdAt: string;
}

export interface UpsertCoachExerciseInput {
  id?: string;
  name: string;
  instructions: string[];
  cues: string[];
  tips?: string | null;
  photos?: CoachExercisePhoto[];
  isShared?: boolean;
}

export interface UpsertCoachWorkoutInput {
  id?: string;
  name: string;
  focus?: string | null;
  durationMinutes: number;
  intensityTier: number;
  movements: CoachWorkoutMovement[];
  tags: string[];
  notes?: string | null;
  isShared?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStatus(value: unknown): CoachWorkoutStatus {
  return value === 'published' ? 'published' : 'draft';
}

function readPhotos(value: unknown): CoachExercisePhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const photos: CoachExercisePhoto[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const path = readString(row.path);
    if (!path) {
      continue;
    }
    const caption = readString(row.caption);
    photos.push(caption ? { path, caption } : { path });
  }
  return photos;
}

function mapCoachWodError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to manage coach workouts.';
  }
  if (message.includes('Not authorized')) {
    return 'Not authorized.';
  }
  return message;
}

function parseExercise(row: Record<string, unknown>): CoachExercise | null {
  const id = readString(row.id);
  const name = readString(row.name);
  const createdAt = readString(row.createdAt);
  const updatedAt = readString(row.updatedAt);
  if (!id || !name || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    name,
    instructions: asStringArray(row.instructions),
    cues: asStringArray(row.cues),
    tips: readString(row.tips),
    photos: readPhotos(row.photos),
    isShared: row.isShared === true,
    isOwner: row.isOwner !== false,
    createdAt,
    updatedAt,
  };
}

function parseMovement(row: Record<string, unknown>): CoachWorkoutMovement | null {
  const name = readString(row.name);
  if (!name) {
    return null;
  }
  const movement: CoachWorkoutMovement = { name };
  const target = readNumber(row.target);
  if (target !== null) {
    movement.target = target;
  }
  const unit = readString(row.unit);
  if (unit !== null) {
    movement.unit = unit;
  }
  const coachExerciseId = readString(row.coachExerciseId);
  if (coachExerciseId !== null) {
    movement.coachExerciseId = coachExerciseId;
  }
  return movement;
}

function parseWorkoutSummary(row: Record<string, unknown>): CoachWorkoutSummary | null {
  const id = readString(row.id);
  const name = readString(row.name);
  const durationMinutes = readNumber(row.durationMinutes);
  const intensityTier = readNumber(row.intensityTier);
  const movementCount = readNumber(row.movementCount);
  const updatedAt = readString(row.updatedAt);
  if (
    !id ||
    !name ||
    durationMinutes === null ||
    intensityTier === null ||
    movementCount === null ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    name,
    focus: readString(row.focus),
    durationMinutes,
    intensityTier,
    tags: asStringArray(row.tags),
    movementCount,
    isLocked: row.isLocked === true,
    status: readStatus(row.status),
    isShared: row.isShared === true,
    isOwner: row.isOwner !== false,
    updatedAt,
  };
}

function parseWorkout(row: Record<string, unknown>): CoachWorkout | null {
  const id = readString(row.id);
  const name = readString(row.name);
  const durationMinutes = readNumber(row.durationMinutes);
  const intensityTier = readNumber(row.intensityTier);
  const createdAt = readString(row.createdAt);
  const updatedAt = readString(row.updatedAt);
  if (!id || !name || durationMinutes === null || intensityTier === null || !createdAt || !updatedAt) {
    return null;
  }
  const movements = asArray(row.movements)
    .map(parseMovement)
    .filter((m): m is CoachWorkoutMovement => m !== null);
  return {
    id,
    name,
    focus: readString(row.focus),
    durationMinutes,
    intensityTier,
    movements,
    tags: asStringArray(row.tags),
    notes: readString(row.notes),
    isLocked: row.isLocked === true,
    status: readStatus(row.status),
    isShared: row.isShared === true,
    isOwner: row.isOwner !== false,
    createdAt,
    updatedAt,
  };
}

function parsePublishedMovementExercise(
  value: unknown
): PublishedCoachWorkoutMovement['exercise'] {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    instructions: asStringArray(row.instructions),
    cues: asStringArray(row.cues),
    tips: readString(row.tips),
    photos: readPhotos(row.photos),
  };
}

function parsePublishedMovement(
  row: Record<string, unknown>
): PublishedCoachWorkoutMovement | null {
  const name = readString(row.name);
  if (!name) {
    return null;
  }
  const movement: PublishedCoachWorkoutMovement = {
    name,
    exercise: parsePublishedMovementExercise(row.exercise),
  };
  const target = readNumber(row.target);
  if (target !== null) {
    movement.target = target;
  }
  const unit = readString(row.unit);
  if (unit !== null) {
    movement.unit = unit;
  }
  return movement;
}

function parsePublishedWorkout(row: Record<string, unknown>): PublishedCoachWorkout | null {
  const id = readString(row.id);
  const name = readString(row.name);
  const durationMinutes = readNumber(row.durationMinutes);
  const intensityTier = readNumber(row.intensityTier);
  const updatedAt = readString(row.updated_at ?? row.updatedAt);
  if (!id || !name || durationMinutes === null || intensityTier === null || !updatedAt) {
    return null;
  }
  const movements = asArray(row.movements)
    .map(parsePublishedMovement)
    .filter((m): m is PublishedCoachWorkoutMovement => m !== null);
  return {
    id,
    name,
    focus: readString(row.focus),
    durationMinutes,
    intensityTier,
    tags: asStringArray(row.tags),
    notes: readString(row.notes),
    movements,
    updatedAt,
  };
}

function parseWorkoutHistoryEntry(row: Record<string, unknown>): CoachWorkoutHistoryEntry | null {
  const sessionId = readString(row.session_id);
  const nickname = readString(row.nickname);
  const role = readString(row.role);
  const state = readString(row.state);
  const createdAt = readString(row.created_at);
  if (!sessionId || !nickname || !role || !state || !createdAt) {
    return null;
  }
  return {
    sessionId,
    nickname,
    role,
    state,
    finalScore: readNumber(row.final_score),
    createdAt,
  };
}

export async function fetchCoachExercises(search?: string | null): Promise<{
  data: CoachExercise[] | null;
  error: CoachWodApiError | null;
}> {
  const { data, error } = await callRpc('coach_list_exercises', { p_search: search ?? null });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const exercises = asArray(raw.exercises)
    .map(parseExercise)
    .filter((e): e is CoachExercise => e !== null);

  return { data: exercises, error: null };
}

export async function upsertCoachExercise(input: UpsertCoachExerciseInput): Promise<{
  data: CoachExercise | null;
  error: CoachWodApiError | null;
}> {
  const { data, error } = await callRpc('coach_upsert_exercise', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_instructions: input.instructions,
    p_cues: input.cues,
    p_tips: input.tips ?? null,
    p_photos: input.photos ?? [],
    p_is_shared: input.isShared ?? false,
  });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const exercise = parseExercise(asRecord(raw.exercise));
  if (!exercise) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: exercise, error: null };
}

export async function deleteCoachExercise(
  id: string
): Promise<{ data: boolean; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_delete_exercise', { p_id: id });

  if (error) {
    return { data: false, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: false, error: { message: 'Exercise not found. It may have already been deleted.' } };
  }

  return { data: true, error: null };
}

export async function fetchCoachWorkouts(input: {
  search?: string | null;
  tag?: string | null;
}): Promise<{ data: CoachWorkoutSummary[] | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_list_workouts', {
    p_search: input.search ?? null,
    p_tag: input.tag ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const workouts = asArray(raw.workouts)
    .map(parseWorkoutSummary)
    .filter((w): w is CoachWorkoutSummary => w !== null);

  return { data: workouts, error: null };
}

export async function fetchCoachWorkout(
  id: string
): Promise<{ data: CoachWorkout | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_get_workout', { p_id: id });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true || !raw.workout) {
    return { data: null, error: { message: 'Workout not found.' } };
  }

  const workout = parseWorkout(asRecord(raw.workout));
  if (!workout) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: workout, error: null };
}

export async function upsertCoachWorkout(input: UpsertCoachWorkoutInput): Promise<{
  data: CoachWorkout | null;
  error: CoachWodApiError | null;
}> {
  const { data, error } = await callRpc('coach_upsert_workout', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_focus: input.focus ?? null,
    p_duration_minutes: input.durationMinutes,
    p_intensity_tier: input.intensityTier,
    p_movements: input.movements,
    p_tags: input.tags,
    p_notes: input.notes ?? null,
    p_is_shared: input.isShared ?? false,
  });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const workout = parseWorkout(asRecord(raw.workout));
  if (!workout) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: workout, error: null };
}

export async function deleteCoachWorkout(
  id: string
): Promise<{ data: boolean; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_delete_workout', { p_id: id });

  if (error) {
    return { data: false, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    if (raw.reason === 'locked') {
      return {
        data: false,
        error: {
          message:
            'Workout is locked — it has a completed session. Clone it to make changes.',
        },
      };
    }
    return { data: false, error: { message: 'Workout not found. It may have already been deleted.' } };
  }

  return { data: true, error: null };
}

export async function cloneCoachWorkout(
  id: string
): Promise<{ data: CoachWorkout | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_clone_workout', { p_id: id });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const workout = parseWorkout(asRecord(raw.workout));
  if (!workout) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: workout, error: null };
}

export async function cloneCoachExercise(
  id: string
): Promise<{ data: CoachExercise | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_clone_exercise', { p_id: id });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const exercise = parseExercise(asRecord(raw.exercise));
  if (!exercise) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: exercise, error: null };
}

export async function setCoachWorkoutStatus(
  id: string,
  status: CoachWorkoutStatus
): Promise<{ data: CoachWorkout | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_set_workout_status', {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const workout = parseWorkout(asRecord(raw.workout));
  if (!workout) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: workout, error: null };
}

export async function fetchPublishedCoachWorkouts(input: {
  search?: string | null;
  tag?: string | null;
  limit?: number;
}): Promise<{ data: PublishedCoachWorkout[] | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('list_published_coach_workouts', {
    p_search: input.search ?? null,
    p_tag: input.tag ?? null,
    p_limit: input.limit ?? 50,
  });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const workouts = asArray(raw.workouts)
    .map(parsePublishedWorkout)
    .filter((w): w is PublishedCoachWorkout => w !== null);

  return { data: workouts, error: null };
}

export async function fetchCoachWorkoutHistory(
  id: string
): Promise<{ data: CoachWorkoutHistoryEntry[] | null; error: CoachWodApiError | null }> {
  const { data, error } = await callRpc('coach_workout_history', { p_id: id });

  if (error) {
    return { data: null, error: { message: mapCoachWodError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const sessions = asArray(raw.sessions)
    .map(parseWorkoutHistoryEntry)
    .filter((s): s is CoachWorkoutHistoryEntry => s !== null);

  return { data: sessions, error: null };
}
