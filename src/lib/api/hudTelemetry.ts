import { callRpc } from '@/lib/api/callRpc';
import type {
  ClassificationProgress,
  ClassificationRank,
  HudClassification,
  HudDomainMinutes,
  HudOvertraining,
  HUDTelemetryPayload,
} from '@/lib/hud/types';

export type HudTelemetryApiError = {
  message: string;
};

const CLASSIFICATION_RANKS = new Set<ClassificationRank>([
  'unclassified',
  'civilian',
  'operator',
  'special_ops',
]);

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNonNegativeInt(value: unknown): number | null {
  const n = readNumber(value);
  if (n === null || n < 0 || !Number.isInteger(n)) {
    return null;
  }
  return n;
}

function readNonNegativeNumber(value: unknown): number | null {
  const n = readNumber(value);
  if (n === null || n < 0) {
    return null;
  }
  return n;
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

function readDomainMinutes(value: unknown): HudDomainMinutes | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const five = readNonNegativeInt(row['5']);
  const ten = readNonNegativeInt(row['10']);
  const fifteen = readNonNegativeInt(row['15']);
  const twenty = readNonNegativeInt(row['20']);
  const other = readNonNegativeInt(row.other);

  if (
    five === null ||
    ten === null ||
    fifteen === null ||
    twenty === null ||
    other === null
  ) {
    return null;
  }

  return { 5: five, 10: ten, 15: fifteen, 20: twenty, other };
}

function readClassificationRank(value: unknown): ClassificationRank | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (!CLASSIFICATION_RANKS.has(value as ClassificationRank)) {
    return null;
  }
  return value as ClassificationRank;
}

function readClassificationProgress(
  value: unknown
): ClassificationProgress | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const weekMinutes = readNonNegativeInt(row.weekMinutes);
  const intensity3PlusCount = readNonNegativeInt(row.intensity3PlusCount);
  const intensity4PlusCount = readNonNegativeInt(row.intensity4PlusCount);
  const marathon20Count = readNonNegativeInt(row.marathon20Count);

  if (
    weekMinutes === null ||
    intensity3PlusCount === null ||
    intensity4PlusCount === null ||
    marathon20Count === null
  ) {
    return null;
  }

  return {
    weekMinutes,
    intensity3PlusCount,
    intensity4PlusCount,
    marathon20Count,
  };
}

function readOvertraining(value: unknown): HudOvertraining | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const acuteLoad7d = readNonNegativeNumber(row.acuteLoad7d);
  const chronicWeeklyLoad28d = readNonNegativeNumber(row.chronicWeeklyLoad28d);
  const consecutiveHighIntensityDays = readNonNegativeInt(
    row.consecutiveHighIntensityDays
  );

  if (
    acuteLoad7d === null ||
    chronicWeeklyLoad28d === null ||
    consecutiveHighIntensityDays === null
  ) {
    return null;
  }

  return { acuteLoad7d, chronicWeeklyLoad28d, consecutiveHighIntensityDays };
}

function readClassification(value: unknown): HudClassification | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const current = readClassificationRank(row.current);
  const previous = readClassificationRank(row.previous);
  const progress = readClassificationProgress(row.progress);

  if (current === null || previous === null || progress === null) {
    return null;
  }

  return { current, previous, progress };
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
  const domainMinutes30d = readDomainMinutes(row.domainMinutes30d);
  const classification = readClassification(row.classification);
  const overtraining = readOvertraining(row.overtraining);

  if (
    weekMinutes === null ||
    weekMinutes < 0 ||
    !weekEndsAt ||
    attrition === null ||
    domainMinutes30d === null ||
    classification === null ||
    overtraining === null
  ) {
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
    domainMinutes30d,
    classification,
    overtraining,
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
  const { data, error } = await callRpc('hud_telemetry', {
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
