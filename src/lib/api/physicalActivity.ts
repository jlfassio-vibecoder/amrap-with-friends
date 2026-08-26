import { callRpc } from '@/lib/api/callRpc';

export type PhysicalActivityApiError = { message: string };

export interface PhysicalActivityEntry {
  id: string;
  activityType: string;
  activityCategory: string;
  activityLabel: string;
  durationMinutes: number;
  intensityTier: number;
  occurredAt: string;
  notes: string | null;
  createdAt: string;
}

export interface LogPhysicalActivityInput {
  activityType: string;
  durationMinutes: number;
  intensityTier: number;
  occurredAt: string;
  notes?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
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

function mapPhysicalActivityError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to log physical activity.';
  }
  if (message.includes('Unknown activity type')) {
    return 'Select a valid activity type.';
  }
  if (message.includes('Duration must be')) {
    return 'Duration must be between 1 and 600 minutes.';
  }
  if (message.includes('Intensity must be')) {
    return 'Intensity must be between 1 and 5.';
  }
  if (message.includes('cannot be in the future')) {
    return 'Activity date cannot be in the future.';
  }
  if (message.includes('280 characters')) {
    return 'Notes must be 280 characters or fewer.';
  }
  return message;
}

function parseEntry(row: Record<string, unknown>): PhysicalActivityEntry | null {
  const id = readString(row.id);
  const activityType = readString(row.activityType);
  const durationMinutes = readNumber(row.durationMinutes);
  const intensityTier = readNumber(row.intensityTier);
  const occurredAt = readString(row.occurredAt);
  const createdAt = readString(row.createdAt);
  if (
    !id ||
    !activityType ||
    durationMinutes === null ||
    intensityTier === null ||
    !occurredAt ||
    !createdAt
  ) {
    return null;
  }
  return {
    id,
    activityType,
    activityCategory: readString(row.activityCategory) ?? '',
    activityLabel: readString(row.activityLabel) ?? activityType,
    durationMinutes,
    intensityTier,
    occurredAt,
    notes: readString(row.notes),
    createdAt,
  };
}

export async function logPhysicalActivity(input: LogPhysicalActivityInput): Promise<{
  data: PhysicalActivityEntry | null;
  error: PhysicalActivityApiError | null;
}> {
  const { data, error } = await callRpc('log_physical_activity', {
    p_activity_type: input.activityType,
    p_duration_minutes: input.durationMinutes,
    p_intensity_tier: input.intensityTier,
    p_occurred_at: input.occurredAt,
    p_notes: input.notes ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapPhysicalActivityError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const entry = parseEntry(asRecord(raw.entry));
  if (!entry) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: entry, error: null };
}

export async function updatePhysicalActivity(
  id: string,
  input: LogPhysicalActivityInput
): Promise<{ data: PhysicalActivityEntry | null; error: PhysicalActivityApiError | null }> {
  const { data, error } = await callRpc('update_physical_activity', {
    p_id: id,
    p_activity_type: input.activityType,
    p_duration_minutes: input.durationMinutes,
    p_intensity_tier: input.intensityTier,
    p_occurred_at: input.occurredAt,
    p_notes: input.notes ?? null,
  });

  if (error) {
    return { data: null, error: { message: mapPhysicalActivityError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Entry not found. It may have already been deleted.' },
    };
  }

  const entry = parseEntry(asRecord(raw.entry));
  if (!entry) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  return { data: entry, error: null };
}

export async function deletePhysicalActivity(
  id: string
): Promise<{ data: boolean; error: PhysicalActivityApiError | null }> {
  const { data, error } = await callRpc('delete_physical_activity', { p_id: id });

  if (error) {
    return { data: false, error: { message: mapPhysicalActivityError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return {
      data: false,
      error: { message: 'Entry not found. It may have already been deleted.' },
    };
  }

  return { data: true, error: null };
}

export async function fetchPhysicalActivityList(limit = 50): Promise<{
  data: PhysicalActivityEntry[] | null;
  error: PhysicalActivityApiError | null;
}> {
  const { data, error } = await callRpc('list_physical_activity', { p_limit: limit });

  if (error) {
    return { data: null, error: { message: mapPhysicalActivityError(error.message) } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }

  const entries = asArray(raw.entries)
    .map(parseEntry)
    .filter((entry): entry is PhysicalActivityEntry => entry !== null);

  return { data: entries, error: null };
}
