import { supabase } from '@/lib/supabase';
import type { BiologicalSex } from '@/lib/hud/classificationQuotas';
import type { PerceivedClassification } from '@/lib/hud/compareClassificationRank';

export type AthleteProfile = {
  heightCm: number;
  weightKg: number;
  birthYear: number;
  biologicalSex: BiologicalSex;
  perceivedClassification: PerceivedClassification;
};

export type AthleteProfileApiError = {
  message: string;
};

const PERCEIVED = new Set<PerceivedClassification>([
  'civilian',
  'operator',
  'special_ops',
]);

const SEX = new Set<BiologicalSex>(['M', 'F']);

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseAthleteProfile(value: unknown): AthleteProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const heightCm = readNumber(row.heightCm);
  const weightKg = readNumber(row.weightKg);
  const birthYear = readNumber(row.birthYear);
  const sex = row.biologicalSex;
  const perceived = row.perceivedClassification;
  if (
    heightCm === null ||
    weightKg === null ||
    birthYear === null ||
    typeof sex !== 'string' ||
    !SEX.has(sex as BiologicalSex) ||
    typeof perceived !== 'string' ||
    !PERCEIVED.has(perceived as PerceivedClassification)
  ) {
    return null;
  }
  return {
    heightCm,
    weightKg,
    birthYear,
    biologicalSex: sex as BiologicalSex,
    perceivedClassification: perceived as PerceivedClassification,
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
  return message;
}

export async function fetchAthleteProfile(): Promise<{
  data: AthleteProfile | null;
  missing: boolean;
  error: AthleteProfileApiError | null;
}> {
  const { data, error } = await supabase.rpc('get_athlete_profile');
  if (error) {
    return { data: null, missing: false, error: { message: mapError(error.message) } };
  }

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

export async function upsertAthleteProfile(input: AthleteProfile): Promise<{
  data: AthleteProfile | null;
  error: AthleteProfileApiError | null;
}> {
  const { data, error } = await supabase.rpc('upsert_athlete_profile', {
    p_height_cm: input.heightCm,
    p_weight_kg: input.weightKg,
    p_birth_year: input.birthYear,
    p_perceived_classification: input.perceivedClassification,
    p_biological_sex: input.biologicalSex,
  });

  if (error) {
    return { data: null, error: { message: mapError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const profile = parseAthleteProfile(raw.profile);
  if (!profile) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }
  return { data: profile, error: null };
}
