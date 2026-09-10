import { describe, expect, it } from 'vitest';
import type { SmartRecoveryHistoryEntry } from '@/lib/api/smartRecovery';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { MovementPattern } from '@/lib/smartRecovery/movementPatterns';
import { computeRecoveryLocks, recoveryLockTargetsFromTemplates } from './computeRecoveryLocks';
import { coachWorkoutLockId } from './deriveCoachWorkoutPatterns';
import {
  EXACT_MATCH_LOCK_MS,
  MOVEMENT_PATTERN_LOCK_MS,
  SEVERE_INTENSITY_LOCK_MS,
} from './recoveryRules';

const BASE_TIME = new Date('2026-09-01T12:00:00.000Z');

function template(
  id: string,
  intensityTier: WorkoutTemplate['intensityTier'] = 3
): WorkoutTemplate {
  return {
    id,
    name: id,
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier,
    movements: [],
    tacticalNote: '',
  };
}

function completion(
  overrides: Partial<SmartRecoveryHistoryEntry> & Pick<SmartRecoveryHistoryEntry, 'completedAt'>
): SmartRecoveryHistoryEntry {
  return {
    templateId: 'the-piston',
    intensityTier: 3,
    ...overrides,
  };
}

function patternIndex(entries: Record<string, MovementPattern[]>): Map<string, MovementPattern[]> {
  return new Map(Object.entries(entries));
}

describe('computeRecoveryLocks', () => {
  const templates = [
    template('the-piston', 3),
    template('the-gas-pedal', 3),
    template('the-stronghold', 5),
    template('the-baseline', 4),
  ];

  const targets = recoveryLockTargetsFromTemplates(templates);

  const index = patternIndex({
    'the-piston': ['lower-body', 'upper-push'],
    'the-gas-pedal': ['full-body-conditioning'],
    'the-stronghold': ['lower-body', 'core'],
    'the-baseline': ['core', 'upper-push'],
  });

  it('returns an empty map for empty completion history', () => {
    expect(computeRecoveryLocks([], targets, BASE_TIME, index).size).toBe(0);
  });

  it('locks only the exact-match template', () => {
    const locks = computeRecoveryLocks(
      [completion({ templateId: 'the-piston', completedAt: '2026-09-01T10:00:00.000Z' })],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.has('the-piston')).toBe(true);
    expect(locks.has('the-gas-pedal')).toBe(false);
  });

  it('does not exact-match a different library template', () => {
    const locks = computeRecoveryLocks(
      [completion({ templateId: 'the-piston', completedAt: '2026-09-01T10:00:00.000Z' })],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-gas-pedal')).toBeUndefined();
  });

  it('expires exact-match locks after six days', () => {
    const completedAt = '2026-08-26T12:00:00.000Z';
    const locks = computeRecoveryLocks(
      [completion({ templateId: 'the-piston', completedAt })],
      targets,
      new Date(new Date(completedAt).getTime() + EXACT_MATCH_LOCK_MS),
      index
    );

    expect(locks.has('the-piston')).toBe(false);
  });

  it('locks all tier-4+ templates after a tier-4 completion', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-baseline',
          intensityTier: 4,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-stronghold')?.reason).toBe('severe-intensity');
    expect(locks.get('the-baseline')?.reason).toBe('exact-match');
  });

  it('does not trigger severe-intensity locks for tier-3 completions', () => {
    const isolatedIndex = patternIndex({
      'the-piston': ['upper-pull'],
      'the-gas-pedal': ['full-body-conditioning'],
      'the-stronghold': ['lower-body', 'core'],
      'the-baseline': ['core', 'upper-push'],
    });

    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-piston',
          intensityTier: 3,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      isolatedIndex
    );

    expect(locks.get('the-stronghold')).toBeUndefined();
    expect(locks.get('the-baseline')).toBeUndefined();
  });

  it('expires severe-intensity locks after 72 hours', () => {
    const completedAt = '2026-08-29T12:00:00.000Z';
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: null,
          intensityTier: 4,
          completedAt,
        }),
      ],
      targets,
      new Date(new Date(completedAt).getTime() + SEVERE_INTENSITY_LOCK_MS),
      index
    );

    expect(locks.get('the-stronghold')).toBeUndefined();
    expect(locks.get('the-baseline')).toBeUndefined();
  });

  it('locks templates that overlap the completed workout pattern', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-piston',
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-baseline')?.reason).toBe('movement-pattern');
    expect(locks.get('the-baseline')?.pattern).toBe('upper-push');
  });

  it('does not pattern-lock templates without overlapping patterns', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-gas-pedal',
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-piston')).toBeUndefined();
  });

  it('expires movement-pattern locks after 48 hours', () => {
    const completedAt = '2026-08-30T12:00:00.000Z';
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-piston',
          completedAt,
        }),
      ],
      targets,
      new Date(new Date(completedAt).getTime() + MOVEMENT_PATTERN_LOCK_MS),
      index
    );

    expect(locks.get('the-baseline')).toBeUndefined();
  });

  it('uses longest expiry with strictest reason when exact match is still active', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-stronghold',
          intensityTier: 5,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    const lock = locks.get('the-stronghold');
    expect(lock?.reason).toBe('exact-match');
    expect(lock?.expiresAt.getTime()).toBe(
      new Date('2026-09-01T10:00:00.000Z').getTime() + EXACT_MATCH_LOCK_MS
    );
  });

  it('prefers severe-intensity reason over movement-pattern when both are active', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-baseline',
          intensityTier: 4,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-stronghold')?.reason).toBe('severe-intensity');
  });

  it('applies severe-intensity for coach completions without exact-matching library ids', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'coach:550e8400-e29b-41d4-a716-446655440000',
          intensityTier: 5,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-stronghold')?.reason).toBe('severe-intensity');
    expect(locks.get('the-piston')).toBeUndefined();
  });

  it('handles null template ids with severe-intensity only when tier is high enough', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: null,
          intensityTier: 4,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-baseline')?.reason).toBe('severe-intensity');
    expect(locks.get('the-piston')).toBeUndefined();
  });

  it('keeps the longest remaining lock when multiple completions target the same template', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-piston',
          completedAt: '2026-08-31T12:00:00.000Z',
        }),
        completion({
          templateId: 'the-piston',
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    expect(locks.get('the-piston')?.expiresAt.toISOString()).toBe(
      new Date(new Date('2026-09-01T10:00:00.000Z').getTime() + EXACT_MATCH_LOCK_MS).toISOString()
    );
  });

  it('sets pattern on movement-pattern locks for multi-pattern templates', () => {
    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-stronghold',
          intensityTier: 3,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      targets,
      BASE_TIME,
      index
    );

    const lock = locks.get('the-baseline');
    expect(lock?.reason).toBe('movement-pattern');
    expect(lock?.pattern).toBe('core');
  });

  it('locks coach tier-4+ targets after a coach tier-5 completion', () => {
    const coachId = '550e8400-e29b-41d4-a716-446655440000';
    const coachTargets = [
      ...targets,
      { id: coachWorkoutLockId(coachId), intensityTier: 5 },
      { id: coachWorkoutLockId('other-coach'), intensityTier: 3 },
    ];

    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: coachWorkoutLockId(coachId),
          intensityTier: 5,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      coachTargets,
      BASE_TIME,
      index
    );

    expect(locks.get(coachWorkoutLockId(coachId))?.reason).toBe('exact-match');
    expect(locks.get(coachWorkoutLockId('other-coach'))).toBeUndefined();
    expect(locks.get('the-stronghold')?.reason).toBe('severe-intensity');
  });

  it('exact-matches a coach completion to the same coach target only', () => {
    const coachId = '550e8400-e29b-41d4-a716-446655440000';
    const coachTargets = [
      { id: coachWorkoutLockId(coachId), intensityTier: 3 },
      { id: coachWorkoutLockId('other-coach'), intensityTier: 3 },
    ];

    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: coachWorkoutLockId(coachId),
          intensityTier: 3,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      coachTargets,
      BASE_TIME,
      index
    );

    expect(locks.get(coachWorkoutLockId(coachId))?.reason).toBe('exact-match');
    expect(locks.get(coachWorkoutLockId('other-coach'))).toBeUndefined();
  });

  it('pattern-locks coach targets from a library completion', () => {
    const coachTargets = [...targets, { id: coachWorkoutLockId('coach-core'), intensityTier: 3 }];
    const mergedIndex = patternIndex({
      ...Object.fromEntries(index),
      [coachWorkoutLockId('coach-core')]: ['core', 'upper-push'],
    });

    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: 'the-stronghold',
          intensityTier: 3,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      coachTargets,
      BASE_TIME,
      mergedIndex
    );

    expect(locks.get(coachWorkoutLockId('coach-core'))?.reason).toBe('movement-pattern');
  });

  it('pattern-locks library targets from a coach completion', () => {
    const coachId = '550e8400-e29b-41d4-a716-446655440000';
    const coachTargets = [...targets, { id: coachWorkoutLockId(coachId), intensityTier: 3 }];
    const mergedIndex = patternIndex({
      ...Object.fromEntries(index),
      [coachWorkoutLockId(coachId)]: ['lower-body', 'core'],
    });

    const locks = computeRecoveryLocks(
      [
        completion({
          templateId: coachWorkoutLockId(coachId),
          intensityTier: 3,
          completedAt: '2026-09-01T10:00:00.000Z',
        }),
      ],
      coachTargets,
      BASE_TIME,
      mergedIndex
    );

    expect(locks.get('the-piston')?.reason).toBe('movement-pattern');
  });
});
