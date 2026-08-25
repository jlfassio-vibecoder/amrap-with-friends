import { describe, it, expect } from 'vitest';
import { parseAthleteProfile } from './athleteProfile';

describe('parseAthleteProfile', () => {
  const valid = {
    heightCm: 180,
    weightKg: 80,
    birthYear: 1994,
    biologicalSex: 'M',
    perceivedClassification: 'civilian',
  };

  it('parses a complete dossier including biological sex', () => {
    expect(parseAthleteProfile(valid)).toEqual(valid);
  });

  it('rejects missing or invalid biological sex', () => {
    expect(parseAthleteProfile({ ...valid, biologicalSex: undefined })).toBeNull();
    expect(parseAthleteProfile({ ...valid, biologicalSex: 'X' })).toBeNull();
  });
});
