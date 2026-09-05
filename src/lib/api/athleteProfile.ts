import { callRpc } from '@/lib/api/callRpc';
import type { BiologicalSex } from '@/lib/hud/classificationQuotas';
import type { PerceivedClassification } from '@/lib/hud/compareClassificationRank';

export type AthleteProfile = {
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  biologicalSex: BiologicalSex | null;
  perceivedClassification: PerceivedClassification | null;
  username: string;
  nickname: string;
};

/** Full-metrics payload for the profile / HUD metrics form. */
export type AthleteProfileMetricsInput = {
  heightCm: number;
  weightKg: number;
  birthYear: number;
  biologicalSex: BiologicalSex;
  perceivedClassification: PerceivedClassification;
  username: string;
  nickname: string;
};

export type AthleteIdentityInput = {
  username: string;
  nickname: string;
};

export type AthleteProfileApiError = {
  message: string;
};

const PERCEIVED = new Set<PerceivedClassification>(['civilian', 'operator', 'special_ops']);

const SEX = new Set<BiologicalSex>(['M', 'F']);

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readOptionalSex(value: unknown): BiologicalSex | null {
  return typeof value === 'string' && SEX.has(value as BiologicalSex)
    ? (value as BiologicalSex)
    : null;
}

function readOptionalPerceived(value: unknown): PerceivedClassification | null {
  return typeof value === 'string' && PERCEIVED.has(value as PerceivedClassification)
    ? (value as PerceivedClassification)
    : null;
}

/** True when body metrics + rank are present for HUD classification quotas. */
export function hasAthleteBodyMetrics(profile: AthleteProfile | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  return (
    profile.heightCm !== null &&
    profile.weightKg !== null &&
    profile.birthYear !== null &&
    profile.biologicalSex !== null &&
    profile.perceivedClassification !== null
  );
}

export function parseAthleteProfile(value: unknown): AthleteProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    heightCm: readNumber(row.heightCm),
    weightKg: readNumber(row.weightKg),
    birthYear: readNumber(row.birthYear),
    biologicalSex: readOptionalSex(row.biologicalSex),
    perceivedClassification: readOptionalPerceived(row.perceivedClassification),
    username: readOptionalString(row.username),
    nickname: readOptionalString(row.nickname),
  };
}

function mapError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to complete intake.';
  }
  if (message.includes('Cannot downgrade')) {
    return 'You cannot downgrade your claimed rank.';
  }
  if (message.includes('That username is already taken')) {
    return 'That username is already taken.';
  }
  return message;
}

function parseProfileResponse(data: unknown): {
  data: AthleteProfile | null;
  missing: boolean;
  error: AthleteProfileApiError | null;
} {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok === false && raw.reason === 'missing') {
    return { data: null, missing: true, error: null };
  }
  if (raw.ok !== true) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const profile = parseAthleteProfile(raw.profile);
  if (!profile) {
    return {
      data: null,
      missing: false,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }
  return { data: profile, missing: false, error: null };
}

export async function fetchAthleteProfile(): Promise<{
  data: AthleteProfile | null;
  missing: boolean;
  error: AthleteProfileApiError | null;
}> {
  const { data, error } = await callRpc('get_athlete_profile');
  if (error) {
    return { data: null, missing: false, error: { message: mapError(error.message) } };
  }
  return parseProfileResponse(data);
}

export async function upsertAthleteProfile(input: AthleteProfileMetricsInput): Promise<{
  data: AthleteProfile | null;
  error: AthleteProfileApiError | null;
}> {
  const { data, error } = await callRpc('upsert_athlete_profile', {
    p_height_cm: input.heightCm,
    p_weight_kg: input.weightKg,
    p_birth_year: input.birthYear,
    p_perceived_classification: input.perceivedClassification,
    p_biological_sex: input.biologicalSex,
    p_username: input.username,
    p_nickname: input.nickname,
  });

  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const parsed = parseProfileResponse(data);
  if (parsed.error || !parsed.data) {
    return {
      data: null,
      error: parsed.error ?? { message: 'Something went wrong. Please try again.' },
    };
  }
  return { data: parsed.data, error: null };
}

export async function upsertAthleteIdentity(input: AthleteIdentityInput): Promise<{
  data: AthleteProfile | null;
  error: AthleteProfileApiError | null;
}> {
  const { data, error } = await callRpc('upsert_athlete_identity', {
    p_username: input.username,
    p_nickname: input.nickname,
  });

  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const parsed = parseProfileResponse(data);
  if (parsed.error || !parsed.data) {
    return {
      data: null,
      error: parsed.error ?? { message: 'Something went wrong. Please try again.' },
    };
  }
  return { data: parsed.data, error: null };
}
