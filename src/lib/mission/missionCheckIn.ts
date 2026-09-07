import { CHECK_IN_DIMENSIONS, RPE_OPTIONS, type CheckInDimensionId } from '@/data/missionCheckIn';

/** Matches outside-activity notes and keeps a result row bounded. */
export const MAX_SESSION_NOTES_LENGTH = 280;

/** Refuse to store an unbounded jsonb blob from a malformed client. */
export const MAX_CHECK_INS_JSON_LENGTH = 500;

/** `{ dimensionId: optionId }` — omit unset dimensions. */
export type MissionCheckIns = Partial<Record<CheckInDimensionId, string>>;

export interface MissionCheckInSelection {
  rpe: number | null;
  sessionNotes: string;
  checkIns: MissionCheckIns;
}

const DIMENSION_IDS = new Set<string>(CHECK_IN_DIMENSIONS.map((dimension) => dimension.id));

const OPTION_BY_ID = new Map(
  CHECK_IN_DIMENSIONS.flatMap((dimension) =>
    dimension.options.map((option) => [option.id, { dimensionId: dimension.id, option }] as const)
  )
);

const RPE_VALUES = new Set(RPE_OPTIONS.map((option) => option.value));

export function normalizeRpe(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || !RPE_VALUES.has(value)) {
    return null;
  }
  return value;
}

export function normalizeSessionNotes(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, MAX_SESSION_NOTES_LENGTH);
}

/**
 * Keep only known dimensions and option ids that belong to that dimension.
 * One choice per dimension; unknown keys and ids are dropped.
 */
export function normalizeCheckIns(value: unknown): MissionCheckIns {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const cleaned: MissionCheckIns = {};
  for (const [rawKey, rawOptionId] of Object.entries(value as Record<string, unknown>)) {
    if (!DIMENSION_IDS.has(rawKey) || typeof rawOptionId !== 'string') {
      continue;
    }
    const known = OPTION_BY_ID.get(rawOptionId);
    if (!known || known.dimensionId !== rawKey) {
      continue;
    }
    cleaned[rawKey as CheckInDimensionId] = known.option.id;
  }

  if (JSON.stringify(cleaned).length > MAX_CHECK_INS_JSON_LENGTH) {
    return {};
  }

  return cleaned;
}

export function readRpe(value: unknown): number | null {
  return normalizeRpe(value);
}

export function readSessionNotes(value: unknown): string {
  return normalizeSessionNotes(value);
}

export function readCheckIns(value: unknown): MissionCheckIns {
  return normalizeCheckIns(value);
}

export function hasCheckInContent(selection: {
  rpe: number | null;
  sessionNotes: string;
  checkIns: MissionCheckIns;
}): boolean {
  return (
    selection.rpe !== null ||
    selection.sessionNotes.length > 0 ||
    Object.keys(selection.checkIns).length > 0
  );
}

/** "RPE 7 · Starting soreness: Mild · Felt pain" for badges and titles. */
export function formatCheckInSummary(selection: {
  rpe: number | null;
  sessionNotes?: string;
  checkIns: MissionCheckIns;
}): string | null {
  const parts: string[] = [];

  if (selection.rpe !== null) {
    const label = RPE_OPTIONS.find((option) => option.value === selection.rpe)?.label;
    parts.push(label ? `RPE ${selection.rpe} (${label})` : `RPE ${selection.rpe}`);
  }

  for (const dimension of CHECK_IN_DIMENSIONS) {
    const optionId = selection.checkIns[dimension.id];
    if (!optionId) {
      continue;
    }
    const option = dimension.options.find((entry) => entry.id === optionId);
    if (!option) {
      continue;
    }
    if (dimension.id === 'pain') {
      parts.push(option.label);
      continue;
    }
    parts.push(`${dimension.title}: ${option.label}`);
  }

  const notes = selection.sessionNotes?.trim() ?? '';
  if (notes.length > 0) {
    parts.push(notes.length > 40 ? `${notes.slice(0, 37)}…` : notes);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function rpeLabel(value: number): string | null {
  return RPE_OPTIONS.find((option) => option.value === value)?.label ?? null;
}
