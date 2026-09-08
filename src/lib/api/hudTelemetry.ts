import { callRpc } from '@/lib/api/callRpc';
import type {
  ClassificationProgress,
  ClassificationRank,
  HudActivity7d,
  HudClassification,
  HudDomainMinutes,
  HudHistoryWeek,
  HudOvertraining,
  HudWeekMission,
  HudWeekPviMission,
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

  if (five === null || ten === null || fifteen === null || twenty === null || other === null) {
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

function readClassificationProgress(value: unknown): ClassificationProgress | null {
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
  const consecutiveHighIntensityDays = readNonNegativeInt(row.consecutiveHighIntensityDays);

  if (
    acuteLoad7d === null ||
    chronicWeeklyLoad28d === null ||
    consecutiveHighIntensityDays === null
  ) {
    return null;
  }

  // Tolerated as missing so a client running ahead of the migration degrades to
  // the old load-only card rather than dropping the whole telemetry payload.
  return {
    acuteLoad7d,
    chronicWeeklyLoad28d,
    consecutiveHighIntensityDays,
    acuteMinutes7d: readNonNegativeNumber(row.acuteMinutes7d) ?? 0,
    chronicWeeklyMinutes28d: readNonNegativeNumber(row.chronicWeeklyMinutes28d) ?? 0,
    observedDays: readNonNegativeInt(row.observedDays) ?? 28,
  };
}

function readActivity7d(value: unknown): HudActivity7d | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const missionCount = readNonNegativeInt(row.missionCount);
  const minutes = readNonNegativeInt(row.minutes);
  const avgRaw = row.avgIntensity;

  if (missionCount === null || minutes === null) {
    return null;
  }

  let avgIntensity: number | null;
  if (avgRaw === null || avgRaw === undefined) {
    avgIntensity = null;
  } else {
    avgIntensity = readNonNegativeNumber(avgRaw);
    if (avgIntensity === null) {
      return null;
    }
  }

  if (missionCount === 0 && avgIntensity !== null) {
    return null;
  }

  return { missionCount, minutes, avgIntensity };
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

function readWeekPviMission(value: unknown): HudWeekPviMission | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const missionId = readString(row.missionId);
  const pvi = readNumber(row.pvi);
  const durationMinutes = readNonNegativeInt(row.durationMinutes);
  const lockedAt = readString(row.lockedAt);
  const templateRaw = row.templateId;

  if (missionId === null || pvi === null || durationMinutes === null || lockedAt === null) {
    return null;
  }

  let templateId: string | null;
  if (templateRaw === null || templateRaw === undefined) {
    templateId = null;
  } else {
    templateId = readString(templateRaw);
    if (templateId === null) {
      return null;
    }
  }

  return { missionId, pvi, durationMinutes, templateId, lockedAt };
}

/** Missing or malformed list → [] so an older RPC does not null the payload. */
function readWeekPviMissions(value: unknown): HudWeekPviMission[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const missions: HudWeekPviMission[] = [];
  for (const item of value) {
    const parsed = readWeekPviMission(item);
    if (parsed === null) {
      return [];
    }
    missions.push(parsed);
  }
  return missions;
}

function readWeekMission(value: unknown): HudWeekMission | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const missionId = readString(row.missionId);
  const durationMinutes = readNonNegativeInt(row.durationMinutes);
  const lockedAt = readString(row.lockedAt);
  const templateRaw = row.templateId;

  // History missions include locked workouts whose PVI is JSON null — a normal
  // ScoreBreakdown value when pacing cannot be computed. Do not reuse
  // readWeekPviMission, which requires a numeric pvi for the weekly PVI card.
  let pvi: number | null;
  if (row.pvi === null || row.pvi === undefined) {
    pvi = null;
  } else {
    pvi = readNumber(row.pvi);
    if (pvi === null) {
      return null;
    }
  }

  if (missionId === null || durationMinutes === null || lockedAt === null) {
    return null;
  }

  let templateId: string | null;
  if (templateRaw === null || templateRaw === undefined) {
    templateId = null;
  } else {
    templateId = readString(templateRaw);
    if (templateId === null) {
      return null;
    }
  }

  const rawScore = row.finalScore;
  if (rawScore === null || rawScore === undefined) {
    return { missionId, pvi, durationMinutes, templateId, lockedAt, finalScore: null };
  }

  const finalScore = readNumber(rawScore);
  if (finalScore === null) {
    return null;
  }
  return { missionId, pvi, durationMinutes, templateId, lockedAt, finalScore };
}

function readHistoryWeek(value: unknown): HudHistoryWeek | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const weekStart = readString(row.weekStart);
  const minutes = readNonNegativeInt(row.minutes);
  const missionCount = readNonNegativeInt(row.missionCount);
  const score = readNumber(row.score);

  if (
    weekStart === null ||
    minutes === null ||
    missionCount === null ||
    score === null ||
    typeof row.compliant !== 'boolean'
  ) {
    return null;
  }

  const rawPvi = row.pviAverage;
  let pviAverage: number | null;
  if (rawPvi === null || rawPvi === undefined) {
    pviAverage = null;
  } else {
    pviAverage = readNumber(rawPvi);
    if (pviAverage === null) {
      return null;
    }
  }

  const rawMissions = row.missions;
  const missions: HudWeekMission[] = [];
  if (Array.isArray(rawMissions)) {
    for (const item of rawMissions) {
      const mission = readWeekMission(item);
      if (mission === null) {
        return null;
      }
      missions.push(mission);
    }
  }

  return {
    weekStart,
    minutes,
    compliant: row.compliant,
    missionCount,
    score,
    pviAverage,
    missions,
  };
}

/**
 * Missing or malformed → `[]`, the same tolerance `readWeekPviMissions` uses:
 * a client running ahead of the week-history migration keeps its telemetry and
 * degrades to the read-only attrition grid rather than losing the whole HUD.
 */
function readHistoryWeeks(value: unknown): HudHistoryWeek[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const weeks: HudHistoryWeek[] = [];
  for (const item of value) {
    const parsed = readHistoryWeek(item);
    if (parsed === null) {
      return [];
    }
    weeks.push(parsed);
  }
  return weeks;
}

export function parseHudTelemetryPayload(value: unknown): HUDTelemetryPayload | null {
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
  const activity7d = readActivity7d(row.activity7d);
  const overtraining = readOvertraining(row.overtraining);

  if (
    weekMinutes === null ||
    weekMinutes < 0 ||
    !weekEndsAt ||
    attrition === null ||
    domainMinutes30d === null ||
    classification === null ||
    activity7d === null ||
    overtraining === null
  ) {
    return null;
  }

  const weekPviAverage = pviRaw === null || pviRaw === undefined ? null : readNumber(pviRaw);

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
    weekPviMissions: readWeekPviMissions(row.weekPviMissions),
    weekEndsAt,
    lastLockedAt,
    attrition,
    weeks: readHistoryWeeks(row.weeks),
    domainMinutes30d,
    classification,
    activity7d,
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

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

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
