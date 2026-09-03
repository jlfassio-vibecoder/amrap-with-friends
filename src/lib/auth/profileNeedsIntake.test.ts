import { describe, expect, it } from 'vitest';
import { isIntakeRequiredMessage, profileNeedsIntake } from './profileNeedsIntake';

describe('profileNeedsIntake', () => {
  it('is true when missing or profile is null', () => {
    expect(profileNeedsIntake(null)).toBe(true);
    expect(profileNeedsIntake({ username: 'a', nickname: 'b' }, true)).toBe(true);
  });

  it('is true when username or nickname is blank', () => {
    expect(profileNeedsIntake({ username: '', nickname: 'Ghost' })).toBe(true);
    expect(profileNeedsIntake({ username: 'ghost', nickname: '  ' })).toBe(true);
  });

  it('is false when both names are present', () => {
    expect(profileNeedsIntake({ username: 'ghost', nickname: 'Ghost' })).toBe(false);
  });
});

describe('isIntakeRequiredMessage', () => {
  it('matches server and mapped client copy', () => {
    expect(isIntakeRequiredMessage('Intake required')).toBe(true);
    expect(isIntakeRequiredMessage('Complete your profile before starting a campaign.')).toBe(true);
    expect(isIntakeRequiredMessage('This campaign is full.')).toBe(false);
  });
});
