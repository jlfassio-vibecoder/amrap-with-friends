import { describe, it, expect } from 'vitest';
import { homeCoachNotice, resolveHomeCoach } from './homeCoach';

const ATHLETE = 'athlete-1';
const COACH_A = 'coach-a';
const COACH_B = 'coach-b';

describe('resolveHomeCoach', () => {
  it('sets the first coach when the athlete has none', () => {
    expect(
      resolveHomeCoach({ current: null, joining: COACH_A, self: ATHLETE, optedIn: true })
    ).toEqual({ action: 'set', coachUserId: COACH_A });
  });

  // The rule that protects a commission from moving between two people who
  // both believe they earned it.
  it('keeps an existing home coach when joining a second room', () => {
    expect(
      resolveHomeCoach({ current: COACH_A, joining: COACH_B, self: ATHLETE, optedIn: true })
    ).toEqual({ action: 'kept', coachUserId: COACH_A });
  });

  it('does nothing when the athlete unticks the box', () => {
    expect(
      resolveHomeCoach({ current: null, joining: COACH_A, self: ATHLETE, optedIn: false })
    ).toEqual({ action: 'none' });
  });

  it('never makes a host their own home coach', () => {
    expect(
      resolveHomeCoach({ current: null, joining: ATHLETE, self: ATHLETE, optedIn: true })
    ).toEqual({ action: 'none' });
  });

  it('is idempotent for an athlete rejoining the same room', () => {
    const first = resolveHomeCoach({
      current: null,
      joining: COACH_A,
      self: ATHLETE,
      optedIn: true,
    });
    expect(first).toEqual({ action: 'set', coachUserId: COACH_A });

    const again = resolveHomeCoach({
      current: COACH_A,
      joining: COACH_A,
      self: ATHLETE,
      optedIn: true,
    });
    expect(again).toEqual({ action: 'kept', coachUserId: COACH_A });
  });
});

describe('homeCoachNotice', () => {
  it('says nothing when nothing happened', () => {
    expect(homeCoachNotice({ action: 'none' }, 'Bay Area CrossFit')).toBeNull();
  });

  it('confirms a first attribution', () => {
    expect(homeCoachNotice({ action: 'set', coachUserId: COACH_A }, 'Bay Area CrossFit')).toBe(
      "You're training with Bay Area CrossFit."
    );
  });

  // Silence here reads as "your coach changed". It has to be said.
  it('tells the athlete their home coach did not change', () => {
    expect(
      homeCoachNotice({ action: 'kept', coachUserId: COACH_A }, 'Bay Area CrossFit', 'Maya')
    ).toBe('You joined Bay Area CrossFit. Maya stays your home coach.');
  });

  it('still says so when it cannot name the existing coach', () => {
    expect(homeCoachNotice({ action: 'kept', coachUserId: COACH_A }, 'Bay Area CrossFit')).toBe(
      'You joined Bay Area CrossFit. Your home coach is unchanged.'
    );
  });
});
