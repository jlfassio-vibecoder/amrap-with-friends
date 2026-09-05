import { describe, expect, it } from 'vitest';
import {
  ageBracket,
  ALPHA_MALE_QUOTAS,
  getClassificationQuotas,
  quotasFromProfile,
} from './classificationQuotas';

describe('ageBracket', () => {
  it('maps under-18 and 18-25 to alpha', () => {
    expect(ageBracket(13)).toBe('alpha');
    expect(ageBracket(18)).toBe('alpha');
    expect(ageBracket(25)).toBe('alpha');
  });

  it('maps remaining brackets', () => {
    expect(ageBracket(26)).toBe('bravo');
    expect(ageBracket(35)).toBe('bravo');
    expect(ageBracket(36)).toBe('charlie');
    expect(ageBracket(45)).toBe('charlie');
    expect(ageBracket(46)).toBe('delta');
    expect(ageBracket(70)).toBe('delta');
  });
});

describe('getClassificationQuotas', () => {
  it('uses Alpha/Bravo male civilian 150 and operator 240 + 2 I3', () => {
    expect(getClassificationQuotas(22, 'M')).toMatchObject({
      civilianMinutes: 150,
      operatorMinutes: 240,
      operatorIntensity3Plus: 2,
    });
    expect(getClassificationQuotas(30, 'M')).toMatchObject({
      civilianMinutes: 150,
      operatorMinutes: 240,
      operatorIntensity3Plus: 2,
    });
  });

  it('uses Alpha/Bravo female civilian 135 and operator 220 + 2 I3', () => {
    expect(getClassificationQuotas(18, 'F')).toMatchObject({
      civilianMinutes: 135,
      operatorMinutes: 220,
      operatorIntensity3Plus: 2,
    });
    expect(getClassificationQuotas(35, 'F')).toMatchObject({
      civilianMinutes: 135,
      operatorMinutes: 220,
      operatorIntensity3Plus: 2,
    });
  });

  it('uses Charlie male/female operator 210 + 1 I3', () => {
    expect(getClassificationQuotas(40, 'M')).toMatchObject({
      civilianMinutes: 135,
      operatorMinutes: 210,
      operatorIntensity3Plus: 1,
    });
    expect(getClassificationQuotas(40, 'F')).toMatchObject({
      civilianMinutes: 120,
      operatorMinutes: 210,
      operatorIntensity3Plus: 1,
    });
  });

  it('uses Delta male/female operator 180 + 1 I3', () => {
    expect(getClassificationQuotas(50, 'M')).toMatchObject({
      civilianMinutes: 135,
      operatorMinutes: 180,
      operatorIntensity3Plus: 1,
    });
    expect(getClassificationQuotas(50, 'F')).toMatchObject({
      civilianMinutes: 120,
      operatorMinutes: 180,
      operatorIntensity3Plus: 1,
    });
  });

  it('keeps Special Ops absolute across demographics', () => {
    for (const age of [13, 22, 40, 50]) {
      for (const sex of ['M', 'F'] as const) {
        expect(getClassificationQuotas(age, sex)).toMatchObject({
          specialOpsMinutes: 300,
          specialOpsIntensity4Plus: 3,
          specialOpsMarathon20: 1,
        });
      }
    }
  });
});

describe('quotasFromProfile', () => {
  it('falls back when profile or metrics are missing', () => {
    expect(quotasFromProfile(null)).toEqual(ALPHA_MALE_QUOTAS);
    expect(quotasFromProfile({ birthYear: null, biologicalSex: 'M' })).toEqual(ALPHA_MALE_QUOTAS);
    expect(quotasFromProfile({ birthYear: 1990, biologicalSex: null })).toEqual(ALPHA_MALE_QUOTAS);
  });

  it('uses birth year and sex when present', () => {
    expect(quotasFromProfile({ birthYear: 2000, biologicalSex: 'F' }, 2022)).toEqual(
      getClassificationQuotas(22, 'F')
    );
  });
});
