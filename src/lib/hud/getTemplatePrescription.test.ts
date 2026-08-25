import { describe, it, expect } from 'vitest';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { ALPHA_MALE_QUOTAS, getClassificationQuotas } from './classificationQuotas';
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

function prescribe(
  template: Pick<WorkoutTemplate, 'intensityTier' | 'durationMinutes'>,
  verified: Parameters<typeof getTemplatePrescription>[1],
  prog: ClassificationProgress,
  perceived?: Parameters<typeof getTemplatePrescription>[4],
  quotas = ALPHA_MALE_QUOTAS
) {
  return getTemplatePrescription(template, verified, prog, quotas, perceived);
}

describe('getTemplatePrescription', () => {
  it('returns none for unclassified (Civilian is volume only)', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 20 },
        'unclassified',
        progress({ weekMinutes: 40 })
      )
    ).toEqual({ required: false });
  });

  it('flags Intensity 3+ for civilian when quota is open', () => {
    expect(
      prescribe(
        { intensityTier: 3, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: INTENSITY 3+' });
  });

  it('does not flag Intensity 2 for civilian I3+ quota', () => {
    expect(
      prescribe(
        { intensityTier: 2, durationMinutes: 20 },
        'civilian',
        progress({ intensity3PlusCount: 0 })
      )
    ).toEqual({ required: false });
  });

  it('drops the civilian I3+ badge once the quota is met', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 2 })
      )
    ).toEqual({ required: false });
  });

  it('flags Tier 4+ for an operator on Intensity 5 when I4+ quota is open and duration is not 20', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 10 },
        'operator',
        progress({ intensity4PlusCount: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: TIER 4+' });
  });

  it('does not flag Intensity 3 for an operator I4+ quota', () => {
    expect(
      prescribe(
        { intensityTier: 3, durationMinutes: 10 },
        'operator',
        progress({ intensity4PlusCount: 1 })
      )
    ).toEqual({ required: false });
  });

  it('prioritizes Marathon over Tier 4+ on a 20-min Intensity 5', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 20 },
        'operator',
        progress({ intensity4PlusCount: 1, marathon20Count: 0 })
      )
    ).toEqual({ required: true, label: 'MANDATE: MARATHON' });
  });

  it('falls back to Tier 4+ on a 20-min Intensity 5 after marathon quota is met', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 20 },
        'operator',
        progress({ intensity4PlusCount: 1, marathon20Count: 1 })
      )
    ).toEqual({ required: true, label: 'MANDATE: TIER 4+' });
  });

  it('returns none when already special_ops', () => {
    expect(
      prescribe(
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

  it('uses PROVE IT Intensity 3+ when civilian-behind-operator', () => {
    expect(
      prescribe(
        { intensityTier: 3, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 1 }),
        'operator'
      )
    ).toEqual({ required: true, label: 'PROVE IT: INTENSITY 3+' });
  });

  it('uses PROVE IT Marathon when civilian-behind-special_ops on a 20-min I5', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 20 },
        'civilian',
        progress({ intensity4PlusCount: 0, marathon20Count: 0 }),
        'special_ops'
      )
    ).toEqual({ required: true, label: 'PROVE IT: MARATHON' });
  });

  it('resumes MANDATE next-tier when verified meets the claim', () => {
    expect(
      prescribe(
        { intensityTier: 5, durationMinutes: 10 },
        'operator',
        progress({ intensity4PlusCount: 1 }),
        'operator'
      )
    ).toEqual({ required: true, label: 'MANDATE: TIER 4+' });
  });

  it('drops Operator I3+ mandate once Delta quota of 1 is met', () => {
    expect(
      prescribe(
        { intensityTier: 3, durationMinutes: 10 },
        'civilian',
        progress({ intensity3PlusCount: 1 }),
        'operator',
        getClassificationQuotas(50, 'F')
      )
    ).toEqual({ required: false });
  });
});
