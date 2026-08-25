import { describe, it, expect } from 'vitest';
import { parseAthleteProfile } from './athleteProfile';

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

  it('parses a complete dossier including biological sex', () => {
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

  it('rejects missing or invalid biological sex', () => {
    expect(parseAthleteProfile({ ...valid, biologicalSex: undefined })).toBeNull();
    expect(parseAthleteProfile({ ...valid, biologicalSex: 'X' })).toBeNull();
  });
});
