import { callRpc } from '@/lib/api/callRpc';

export type SmartRecoveryHistoryEntry = {
  templateId: string | null;
  intensityTier: number;
  completedAt: string;
};

export type SmartRecoveryHistoryPayload = {
  completions: SmartRecoveryHistoryEntry[];
};

export type SmartRecoveryApiError = {
  message: string;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readIntensityTier(value: unknown): number | null {
  const tier = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (tier === null || !Number.isInteger(tier) || tier < 1 || tier > 5) {
    return null;
  }
  return tier;
}

function readTemplateId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return readString(value);
}

export function parseSmartRecoveryHistoryEntry(raw: unknown): SmartRecoveryHistoryEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const intensityTier = readIntensityTier(row.intensity_tier);
  const completedAt = readString(row.completed_at);

  if (intensityTier === null || !completedAt) {
    return null;
  }

  return {
    templateId: readTemplateId(row.template_id),
    intensityTier,
    completedAt,
  };
}

export function parseSmartRecoveryHistoryPayload(raw: unknown): SmartRecoveryHistoryPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.completions)) {
    return null;
  }

  const completions = row.completions
    .map((entry) => parseSmartRecoveryHistoryEntry(entry))
    .filter((entry): entry is SmartRecoveryHistoryEntry => entry !== null);

  return { completions };
}

function mapSmartRecoveryError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to use Smart Recovery.';
  }
  return message;
}

export async function fetchSmartRecoveryHistory(): Promise<{
  data: SmartRecoveryHistoryPayload | null;
  error: SmartRecoveryApiError | null;
}> {
  const { data, error } = await callRpc('smart_recovery_history');

  if (error) {
    return { data: null, error: { message: mapSmartRecoveryError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const payload = parseSmartRecoveryHistoryPayload(raw);
  if (!payload) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { data: payload, error: null };
}
