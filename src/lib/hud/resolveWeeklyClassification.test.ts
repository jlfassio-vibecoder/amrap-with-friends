import { describe, it, expect } from 'vitest';
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

describe('resolveWeeklyClassification', () => {
  it('returns unclassified below 150 minutes', () => {
    expect(resolveWeeklyClassification(progress({ weekMinutes: 149 }))).toBe(
      'unclassified'
    );
  });

  it('returns civilian at 150 with no lethality', () => {
    expect(resolveWeeklyClassification(progress({ weekMinutes: 150 }))).toBe(
      'civilian'
    );
  });

  it('returns operator when volume and intensity 3+ quotas are met', () => {
    expect(
      resolveWeeklyClassification(
        progress({ weekMinutes: 240, intensity3PlusCount: 2 })
      )
    ).toBe('operator');
  });

  it('stays civilian when volume is high but intensity 3+ is short', () => {
    expect(
      resolveWeeklyClassification(
        progress({ weekMinutes: 300, intensity3PlusCount: 1 })
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
        })
      )
    ).toBe('special_ops');
  });

  it('stays operator when special_ops domain or intensity 4+ is missing', () => {
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity3PlusCount: 2,
          intensity4PlusCount: 3,
          marathon20Count: 0,
        })
      )
    ).toBe('operator');
    expect(
      resolveWeeklyClassification(
        progress({
          weekMinutes: 300,
          intensity3PlusCount: 2,
          intensity4PlusCount: 2,
          marathon20Count: 1,
        })
      )
    ).toBe('operator');
  });
});

describe('nextTierChecklist', () => {
  it('lists civilian volume requirement from unclassified', () => {
    const rows = nextTierChecklist(
      'unclassified',
      progress({ weekMinutes: 40 })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'volume-150',
      current: 40,
      required: 150,
      met: false,
    });
  });

  it('lists operator requirements from civilian', () => {
    const rows = nextTierChecklist(
      'civilian',
      progress({ weekMinutes: 200, intensity3PlusCount: 1 })
    );
    expect(rows.map((r) => r.id)).toEqual(['volume-240', 'i3-plus']);
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
      })
    );
    expect(rows.every((r) => r.met)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual([
      'volume-300',
      'i4-plus',
      'marathon-20',
    ]);
  });
});
