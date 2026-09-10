import { describe, expect, it } from 'vitest';
import {
  isValidAthleteUsername,
  sanitizeCallsignUsername,
  suggestAthleteIdentity,
  suggestAthleteIdentityAvoiding,
} from './tacticalCallsign';

/** Deterministic sequence of [0,1) values for tests. */
function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

describe('sanitizeCallsignUsername', () => {
  it('maps hyphens and spaces to underscores within length bounds', () => {
    expect(sanitizeCallsignUsername('Ghost-Actual')).toBe('Ghost_Actual');
    expect(sanitizeCallsignUsername('Viper 2')).toBe('Viper_2');
    expect(isValidAthleteUsername(sanitizeCallsignUsername('Ghost-Actual'))).toBe(true);
  });

  it('strips illegal characters and pads short results', () => {
    expect(sanitizeCallsignUsername('!!')).toMatch(/^[A-Za-z0-9_]{3,30}$/);
    expect(sanitizeCallsignUsername('a')).toMatch(/^[A-Za-z0-9_]{3,30}$/);
  });

  it('truncates to 30 characters', () => {
    const long = 'A'.repeat(40);
    expect(sanitizeCallsignUsername(long)).toHaveLength(30);
  });
});

describe('suggestAthleteIdentity', () => {
  it('returns nickname Prefix-Suffix and a valid username', () => {
    const suggestion = suggestAthleteIdentity(sequenceRandom([0, 0.1, 0]));
    expect(suggestion.nickname).toMatch(/^[A-Za-z]+-(?:[A-Za-z]+|\d{1,2})$/);
    expect(isValidAthleteUsername(suggestion.username)).toBe(true);
    expect(suggestion.username).toBe(sanitizeCallsignUsername(suggestion.nickname));
  });

  it('can emit numeric suffixes', () => {
    // First random: prefix pick; second: <0.55 false → number path; third: number 1-99
    const suggestion = suggestAthleteIdentity(sequenceRandom([0, 0.9, 0.5]));
    expect(suggestion.nickname).toMatch(/^[A-Za-z]+-\d{1,2}$/);
    expect(suggestion.username).toMatch(/^[A-Za-z]+_\d{1,2}$/);
  });

  it('spreads across many distinct usernames over a sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(suggestAthleteIdentity(() => (i * 0.017 + 0.13) % 1).username);
    }
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('suggestAthleteIdentityAvoiding', () => {
  it('skips usernames already taken (case-insensitive)', () => {
    const first = suggestAthleteIdentity(sequenceRandom([0, 0.1, 0]));
    const taken = new Set([first.username.toUpperCase()]);
    const next = suggestAthleteIdentityAvoiding(taken, sequenceRandom([0, 0.1, 0, 0.2, 0.1, 0.5]));
    expect(next.username.toLowerCase()).not.toBe(first.username.toLowerCase());
    expect(isValidAthleteUsername(next.username)).toBe(true);
  });
});
