export type BiologicalSex = 'M' | 'F';

export type AgeBracket = 'alpha' | 'bravo' | 'charlie' | 'delta';

export type ClassificationQuotas = {
  civilianMinutes: number;
  operatorMinutes: number;
  operatorIntensity3Plus: number;
  specialOpsMinutes: number;
  specialOpsIntensity4Plus: number;
  specialOpsMarathon20: number;
};

export const SPECIAL_OPS_MINUTES = 300;
export const SPECIAL_OPS_INTENSITY_4_PLUS = 3;
export const SPECIAL_OPS_MARATHON_20 = 1;

export function ageBracket(age: number): AgeBracket {
  if (age <= 25) {
    return 'alpha';
  }
  if (age <= 35) {
    return 'bravo';
  }
  if (age <= 45) {
    return 'charlie';
  }
  return 'delta';
}

export function getClassificationQuotas(
  age: number,
  sex: BiologicalSex
): ClassificationQuotas {
  const bracket = ageBracket(age);
  const young = bracket === 'alpha' || bracket === 'bravo';

  const civilianMinutes = young
    ? sex === 'M'
      ? 150
      : 135
    : sex === 'M'
      ? 135
      : 120;

  const operatorMinutes = young
    ? sex === 'M'
      ? 240
      : 220
    : bracket === 'charlie'
      ? 210
      : 180;

  return {
    civilianMinutes,
    operatorMinutes,
    operatorIntensity3Plus: young ? 2 : 1,
    specialOpsMinutes: SPECIAL_OPS_MINUTES,
    specialOpsIntensity4Plus: SPECIAL_OPS_INTENSITY_4_PLUS,
    specialOpsMarathon20: SPECIAL_OPS_MARATHON_20,
  };
}

/** Alpha-male Civilian/Operator quotas — matches WEEKLY_BASELINE_MINUTES fallback. */
export const ALPHA_MALE_QUOTAS = getClassificationQuotas(22, 'M');

export function quotasFromProfile(
  profile: { birthYear: number; biologicalSex: BiologicalSex } | null | undefined,
  nowYear: number = new Date().getFullYear()
): ClassificationQuotas {
  if (!profile) {
    return ALPHA_MALE_QUOTAS;
  }
  return getClassificationQuotas(nowYear - profile.birthYear, profile.biologicalSex);
}
