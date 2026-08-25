import { describe, it, expect } from 'vitest';
import { getTemplatePrescription } from './getTemplatePrescription';
import type { ClassificationProgress } from './types';

function progress(
  partial: Partial<ClassificationProgress>
): ClassificationProgress {
  return {
    weekMinutes: 0,
    intensity3PlusCount: 0,
    intensity4PlusCount: 0,
    marathon20Count: 0,
    ...partial,
  };
}

describe('getTemplatePrescription', () => {
  it('returns none for unclassified (Civilian is volume only)', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 20 },
        'unclassified',
        progress({ weekMinutes: 40 })
      )
    ).toEqual({ required: false });
  });

  it('flags Intensity 3+ for civilian when quota is open', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 3, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: INTENSITY 3+' });
  });

  it('does not flag Intensity 2 for civilian I3+ quota', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 2, durationMinutes: 20 },
        'civilian',
        progress({ intensity3PlusCount: 0 })
      )
    ).toEqual({ required: false });
  });

  it('drops the civilian I3+ badge once the quota is met', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 2 })
      )
    ).toEqual({ required: false });
  });

  it('flags Tier 4+ for an operator on Intensity 5 when I4+ quota is open and duration is not 20', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 10 },
        'operator',
        progress({ intensity4PlusCount: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: TIER 4+' });
  });

  it('does not flag Intensity 3 for an operator I4+ quota', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 3, durationMinutes: 10 },
        'operator',
        progress({ intensity4PlusCount: 1 })
      )
    ).toEqual({ required: false });
  });

  it('prioritizes Marathon over Tier 4+ on a 20-min Intensity 5', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 20 },
        'operator',
        progress({ intensity4PlusCount: 1, marathon20Count: 0 })
      )
    ).toEqual({ required: true, label: 'MANDATE: MARATHON' });
  });

  it('falls back to Tier 4+ on a 20-min Intensity 5 after marathon quota is met', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 20 },
        'operator',
        progress({ intensity4PlusCount: 1, marathon20Count: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: TIER 4+' });
  });

  it('returns none when already special_ops', () => {
    expect(
      getTemplatePrescription(
        { intensityTier: 5, durationMinutes: 20 },
        'special_ops',
        progress({
          weekMinutes: 320,
          intensity4PlusCount: 2,
          marathon20Count: 0,
        })
      )
    ).toEqual({ required: false });
  });
});
