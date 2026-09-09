import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';
import {
  recommendChecklistWorkouts,
  templateMatchesChecklistRow,
} from './recommendChecklistWorkouts';

function template(
  id: string,
  overrides: Partial<Pick<WorkoutTemplate, 'name' | 'durationMinutes' | 'intensityTier'>> = {}
): WorkoutTemplate {
  return {
    id,
    name: overrides.name ?? id,
    durationMinutes: overrides.durationMinutes ?? 10,
    category: 'engine-room',
    intensityTier: overrides.intensityTier ?? 2,
    movements: [{ name: 'Burpee', reps: 10 }],
    tacticalNote: '',
  };
}

function lock(templateId: string): TemplateRecoveryLock {
  return {
    templateId,
    reason: 'exact-match',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  };
}

describe('templateMatchesChecklistRow', () => {
  it('matches volume rows to any template', () => {
    expect(templateMatchesChecklistRow('volume-operator', template('a'))).toBe(true);
  });

  it('matches intensity and marathon predicates', () => {
    expect(
      templateMatchesChecklistRow('i3-plus', template('a', { intensityTier: 3 }))
    ).toBe(true);
    expect(
      templateMatchesChecklistRow('i3-plus', template('a', { intensityTier: 2 }))
    ).toBe(false);
    expect(
      templateMatchesChecklistRow('i4-plus', template('a', { intensityTier: 4 }))
    ).toBe(true);
    expect(
      templateMatchesChecklistRow('marathon-20', template('a', { durationMinutes: 20 }))
    ).toBe(true);
    expect(
      templateMatchesChecklistRow('marathon-20', template('a', { durationMinutes: 15 }))
    ).toBe(false);
  });
});

describe('recommendChecklistWorkouts', () => {
  const catalog = [
    template('sprint-a', { durationMinutes: 5, intensityTier: 3, name: 'Sprint A' }),
    template('sprint-b', { durationMinutes: 5, intensityTier: 4, name: 'Sprint B' }),
    template('crucible-a', { durationMinutes: 10, intensityTier: 3, name: 'Crucible A' }),
    template('grind-a', { durationMinutes: 15, intensityTier: 2, name: 'Grind A' }),
    template('marathon-a', { durationMinutes: 20, intensityTier: 4, name: 'Marathon A' }),
    template('marathon-b', { durationMinutes: 20, intensityTier: 5, name: 'Marathon B' }),
    template('marathon-c', { durationMinutes: 20, intensityTier: 3, name: 'Marathon C' }),
  ];

  it('returns three I3+ templates when enough match', () => {
    const recs = recommendChecklistWorkouts('i3-plus', catalog);
    expect(recs).toHaveLength(3);
    expect(recs.every((rec) => rec.intensityTier >= 3)).toBe(true);
  });

  it('returns only 20-min templates for marathon-20', () => {
    const recs = recommendChecklistWorkouts('marathon-20', catalog);
    expect(recs).toHaveLength(3);
    expect(recs.every((rec) => rec.durationMinutes === 20)).toBe(true);
    expect(recs.map((rec) => rec.templateId)).toEqual([
      'marathon-a',
      'marathon-b',
      'marathon-c',
    ]);
  });

  it('excludes Smart Recovery locks when the unlocked pool is large enough', () => {
    const locks = new Map([
      ['sprint-a', lock('sprint-a')],
      ['crucible-a', lock('crucible-a')],
    ]);
    const recs = recommendChecklistWorkouts('i3-plus', catalog, locks);
    expect(recs.map((rec) => rec.templateId)).not.toContain('sprint-a');
    expect(recs.map((rec) => rec.templateId)).not.toContain('crucible-a');
    expect(recs.every((rec) => !rec.locked)).toBe(true);
  });

  it('fills with locked templates only when unlocked matches are scarce', () => {
    const thin = [
      template('only-i4', { intensityTier: 4, durationMinutes: 10 }),
      template('locked-i4', { intensityTier: 5, durationMinutes: 10 }),
    ];
    const locks = new Map([['locked-i4', lock('locked-i4')]]);
    const recs = recommendChecklistWorkouts('i4-plus', thin, locks, null, 3);
    expect(recs).toHaveLength(2);
    expect(recs[0]!.templateId).toBe('only-i4');
    expect(recs[0]!.locked).toBe(false);
    expect(recs[1]!.templateId).toBe('locked-i4');
    expect(recs[1]!.locked).toBe(true);
  });

  it('biases volume recommendations away from a dominant 72h domain', () => {
    const domainMinutes = {
      5: 120,
      10: 10,
      15: 10,
      20: 10,
      other: 0,
      activeRecovery: 0,
    };
    const recs = recommendChecklistWorkouts(
      'volume-operator',
      catalog,
      new Map(),
      domainMinutes,
      3
    );
    // Sprint dominates; prefer non-sprint clocks first.
    expect(recs[0]!.durationMinutes).not.toBe(5);
    expect(recs.every((rec) => rec.durationMinutes !== 5) || recs[0]!.durationMinutes !== 5).toBe(
      true
    );
  });

  it('is deterministic by template id when scores tie', () => {
    const twin = [
      template('z-last', { durationMinutes: 10, intensityTier: 3 }),
      template('a-first', { durationMinutes: 10, intensityTier: 3 }),
      template('m-mid', { durationMinutes: 10, intensityTier: 3 }),
    ];
    const recs = recommendChecklistWorkouts('i3-plus', twin);
    expect(recs.map((rec) => rec.templateId)).toEqual(['a-first', 'm-mid', 'z-last']);
  });
});
