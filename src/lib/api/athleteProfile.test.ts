import { describe, it, expect } from 'vitest';
import { hasAthleteBodyMetrics, parseAthleteProfile } from './athleteProfile';

describe('parseAthleteProfile', () => {
  const valid = {
    heightCm: 180,
    weightKg: 80,
    birthYear: 1994,
    biologicalSex: 'M',
    perceivedClassification: 'civilian',
    username: 'operator_one',
    nickname: 'Ghost',
  };

  it('parses a complete profile including biological sex', () => {
    expect(parseAthleteProfile(valid)).toEqual(valid);
  });

  it('defaults missing username and nickname to empty strings', () => {
    const withoutIdentity = {
      heightCm: valid.heightCm,
      weightKg: valid.weightKg,
      birthYear: valid.birthYear,
      biologicalSex: valid.biologicalSex,
      perceivedClassification: valid.perceivedClassification,
    };
    expect(parseAthleteProfile(withoutIdentity)).toEqual({
      ...withoutIdentity,
      username: '',
      nickname: '',
    });
  });

  it('parses identity-only rows with null metrics', () => {
    expect(
      parseAthleteProfile({
        heightCm: null,
        weightKg: null,
        birthYear: null,
        biologicalSex: null,
        perceivedClassification: null,
        username: 'ghost_actual',
        nickname: 'Ghost-Actual',
      })
    ).toEqual({
      heightCm: null,
      weightKg: null,
      birthYear: null,
      biologicalSex: null,
      perceivedClassification: null,
      username: 'ghost_actual',
      nickname: 'Ghost-Actual',
    });
  });

  it('treats missing or invalid biological sex as null (not a hard reject)', () => {
    expect(parseAthleteProfile({ ...valid, biologicalSex: undefined })).toEqual({
      ...valid,
      biologicalSex: null,
    });
    expect(parseAthleteProfile({ ...valid, biologicalSex: 'X' })).toEqual({
      ...valid,
      biologicalSex: null,
    });
  });
});

describe('hasAthleteBodyMetrics', () => {
  it('requires all metric fields', () => {
    expect(hasAthleteBodyMetrics(null)).toBe(false);
    expect(
      hasAthleteBodyMetrics({
        heightCm: 180,
        weightKg: 80,
        birthYear: 1994,
        biologicalSex: 'M',
        perceivedClassification: 'civilian',
        username: 'a',
        nickname: 'b',
      })
    ).toBe(true);
    expect(
      hasAthleteBodyMetrics({
        heightCm: null,
        weightKg: 80,
        birthYear: 1994,
        biologicalSex: 'M',
        perceivedClassification: 'civilian',
        username: 'a',
        nickname: 'b',
      })
    ).toBe(false);
  });
});
