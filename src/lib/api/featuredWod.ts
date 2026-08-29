import { callRpc } from '@/lib/api/callRpc';

export type FeaturedWodState = 'waiting' | 'setup' | 'work' | 'finished' | null;

export interface FeaturedWod {
  workoutName: string;
  focus: string | null;
  durationMinutes: number;
  intensityTier: number;
  tags: string[];
  scheduledAt: string;
  /** Null until the scheduler has generated the actual session (within its
   * lead window) — the card shows a time but no join CTA until then. */
  sessionId: string | null;
  state: FeaturedWodState;
  /** Wall-clock work start when state is work; null otherwise. */
  startedAt: string | null;
  /** Null until sessionId is set — participant count for the generated
   * session (host included), so the card can show "N joining". */
  attendeeCount: number | null;
}

export type FeaturedWodApiError = { message: string };

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

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readState(value: unknown): FeaturedWodState {
  if (
    value === 'waiting' ||
    value === 'setup' ||
    value === 'work' ||
    value === 'finished'
  ) {
    return value;
  }
  return null;
}

function parseFeaturedWod(row: Record<string, unknown>): FeaturedWod | null {
  const workoutName = readString(row.workoutName);
  const durationMinutes = readNumber(row.durationMinutes);
  const intensityTier = readNumber(row.intensityTier);
  const scheduledAt = readString(row.scheduledAt);
  if (!workoutName || durationMinutes === null || intensityTier === null || !scheduledAt) {
    return null;
  }
  return {
    workoutName,
    focus: readString(row.focus),
    durationMinutes,
    intensityTier,
    tags: Array.isArray(row.tags)
      ? row.tags.filter((t): t is string => typeof t === 'string')
      : [],
    scheduledAt,
    sessionId: readString(row.sessionId),
    state: readState(row.state),
    startedAt: readString(row.startedAt),
    attendeeCount: readNumber(row.attendeeCount),
  };
}

export async function fetchCurrentFeaturedWod(): Promise<{
  data: FeaturedWod | null;
  error: FeaturedWodApiError | null;
}> {
  const { data, error } = await callRpc('current_featured_wod', {});

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const raw = asRecord(data);
  if (raw.ok !== true) {
    return { data: null, error: { message: 'Something went wrong. Please try again.' } };
  }
  if (!raw.featured) {
    return { data: null, error: null };
  }

  const featured = parseFeaturedWod(asRecord(raw.featured));
  if (!featured) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { data: featured, error: null };
}

export function formatFeaturedWodTime(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
