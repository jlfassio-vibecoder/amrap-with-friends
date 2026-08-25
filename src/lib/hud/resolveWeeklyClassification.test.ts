import { describe, it, expect } from 'vitest';
import { ALPHA_MALE_QUOTAS, getClassificationQuotas } from './classificationQuotas';
import { resolveWeeklyClassification } from './resolveWeeklyClassification';
import { nextTierChecklist } from './nextTierChecklist';
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

const alphaMale = ALPHA_MALE_QUOTAS;
const charlieFemale = getClassificationQuotas(40, 'F');
const deltaFemale = getClassificationQuotas(50, 'F');
const deltaMale = getClassificationQuotas(50, 'M');

describe('resolveWeeklyClassification', () => {
  it('returns unclassified below 150 minutes for Alpha male', () => {
    expect(
      resolveWeeklyClassification(progress({ weekMinutes: 149 }), alphaMale)
    ).toBe('unclassified');
  });

  it('returns civilian at 150 with no lethality for Alpha male', () => {
    expect(
      resolveWeeklyClassification(progress({ weekMinutes: 150 }), alphaMale)
    ).toBe('civilian');
  });

  it('returns civilian at 120 for Charlie female', () => {
    expect(
      resolveWeeklyClassification(progress({ weekMinutes: 120 }), charlieFemale)
    ).toBe('civilian');
    expect(
      resolveWeeklyClassification(progress({ weekMinutes: 119 }), charlieFemale)
    ).toBe('unclassified');
  });

  it('returns operator when volume and intensity 3+ quotas are met', () => {
    expect(
      resolveWeeklyClassification(
        progress({ weekMinutes: 240, intensity3PlusCount: 2 }),
        alphaMale
      )
    ).toBe('operator');
  });

  it('returns operator at 180 + 1x I3 for Delta', () => {
    expect(
      resolveWeeklyClassification(
        progress({ weekMinutes: 180, intensity3PlusCount: 1 }),
        deltaMale
      )
    ).toBe('operator');
  });

  it('stays civilian when volume is high but intensity 3+ is short', () => {
    expect(
      resolveWeeklyClassification(
        progress({ weekMinutes: 300, intensity3PlusCount: 1 }),
        alphaMale
      )
    ).toBe('civilian');
  });

  it('returns special_ops when all criteria are met', () => {
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity3PlusCount: 3,
          intensity4PlusCount: 3,
          marathon20Count: 1,
        }),
        alphaMale
      )
    ).toBe('special_ops');
  });

  it('returns special_ops for Delta female on the absolute standard', () => {
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity4PlusCount: 3,
          marathon20Count: 1,
        }),
        deltaFemale
      )
    ).toBe('special_ops');
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 299,
          intensity3PlusCount: 1,
          intensity4PlusCount: 3,
          marathon20Count: 1,
        }),
        deltaFemale
      )
    ).toBe('operator');
  });

  it('stays operator when special_ops domain or intensity 4+ is missing', () => {
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity3PlusCount: 2,
          intensity4PlusCount: 3,
          marathon20Count: 0,
        }),
        alphaMale
      )
    ).toBe('operator');
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity3PlusCount: 2,
          intensity4PlusCount: 2,
          marathon20Count: 1,
        }),
        alphaMale
      )
    ).toBe('operator');
  });
});

describe('nextTierChecklist', () => {
  it('lists civilian volume requirement from unclassified', () => {
    const rows = nextTierChecklist(
      'unclassified',
      progress({ weekMinutes: 40 }),
      alphaMale
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'volume-civilian',
      current: 40,
      required: 150,
      met: false,
    });
  });

  it('lists scaled civilian volume for Charlie female', () => {
    const rows = nextTierChecklist(
      'unclassified',
      progress({ weekMinutes: 40 }),
      charlieFemale
    );
    expect(rows[0]).toMatchObject({
      id: 'volume-civilian',
      required: 120,
    });
  });

  it('lists operator requirements from civilian', () => {
    const rows = nextTierChecklist(
      'civilian',
      progress({ weekMinutes: 200, intensity3PlusCount: 1 }),
      alphaMale
    );
    expect(rows.map((r) => r.id)).toEqual(['volume-operator', 'i3-plus']);
    expect(rows[0]?.met).toBe(false);
    expect(rows[1]?.met).toBe(false);
    expect(rows[1]).toMatchObject({
      label: 'Intensity 3+',
      current: 1,
      required: 2,
    });
  });

  it('lists special ops maintenance when already top', () => {
    const rows = nextTierChecklist(
      'special_ops',
      progress({
        weekMinutes: 320,
        intensity4PlusCount: 3,
        marathon20Count: 1,
      }),
      alphaMale
    );
    expect(rows.every((r) => r.met)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual([
      'volume-special-ops',
      'i4-plus',
      'marathon-20',
    ]);
  });

  it('uses an explicit claimed target instead of the next step', () => {
    const rows = nextTierChecklist(
      'civilian',
      progress({ weekMinutes: 180, intensity4PlusCount: 1 }),
      alphaMale,
      'special_ops'
    );
    expect(rows.map((r) => r.id)).toEqual([
      'volume-special-ops',
      'i4-plus',
      'marathon-20',
    ]);
  });
});
