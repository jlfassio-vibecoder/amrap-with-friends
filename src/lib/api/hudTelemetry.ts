import { supabase } from '@/lib/supabase';
import type { HUDTelemetryPayload } from '@/lib/hud/types';

export type HudTelemetryApiError = {
  message: string;
};

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAttrition(value: unknown): boolean[] | null {
  if (!Array.isArray(value) || value.length !== 12) {
    return null;
  }

  const attrition: boolean[] = [];
  for (const item of value) {
    if (typeof item !== 'boolean') {
      return null;
    }
    attrition.push(item);
  }

  return attrition;
}

export function parseHudTelemetryPayload(
  value: unknown
): HUDTelemetryPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const weekMinutes = readNumber(row.weekMinutes);
  const weekEndsAt = readString(row.weekEndsAt);
  const pviRaw = row.weekPviAverage;
  const lastLockedRaw = row.lastLockedAt;
  const attrition = readAttrition(row.attrition);

  if (weekMinutes === null || weekMinutes < 0 || !weekEndsAt || attrition === null) {
    return null;
  }

  const weekPviAverage =
    pviRaw === null || pviRaw === undefined ? null : readNumber(pviRaw);

  if (pviRaw !== null && pviRaw !== undefined && weekPviAverage === null) {
    return null;
  }

  let lastLockedAt: string | null;
  if (lastLockedRaw === null || lastLockedRaw === undefined) {
    lastLockedAt = null;
  } else {
    lastLockedAt = readString(lastLockedRaw);
    if (lastLockedAt === null) {
      return null;
    }
  }

  return {
    weekMinutes,
    weekPviAverage,
    weekEndsAt,
    lastLockedAt,
    attrition,
  };
}

function mapHudTelemetryError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to view your HUD.';
  }
  if (message.includes('invalid_timezone')) {
    return 'Could not determine your timezone.';
  }
  return message;
}

export async function fetchHudTelemetry(): Promise<{
  data: HUDTelemetryPayload | null;
  error: HudTelemetryApiError | null;
}> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.rpc('hud_telemetry', {
    p_timezone: timeZone,
  });

  if (error) {
    return { data: null, error: { message: mapHudTelemetryError(error.message) } };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok === false && raw.reason === 'invalid_timezone') {
    return {
      data: null,
      error: { message: mapHudTelemetryError('invalid_timezone') },
    };
  }

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const telemetry = parseHudTelemetryPayload(raw.telemetry);
  if (!telemetry) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { data: telemetry, error: null };
}
