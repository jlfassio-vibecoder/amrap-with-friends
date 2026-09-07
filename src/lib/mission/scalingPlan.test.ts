import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_STORED_PLANS,
  clearScalingPlan,
  pruneScalingPlans,
  readScalingPlan,
  resetScalingPlanMemory,
  scalingPlanStorageKey,
  writeScalingPlan,
} from '@/lib/mission/scalingPlan';

const WORKOUT = [{ name: 'Diamond Push-ups' }, { name: 'Air Squats' }];

beforeEach(() => {
  window.localStorage.clear();
  resetScalingPlanMemory();
});

describe('scalingPlan', () => {
  it('round-trips a chosen scaling', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({
      'Diamond Push-ups': 'push-up--knees',
    });
  });

  it('keeps one participant’s plan out of another’s', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    expect(readScalingPlan('m1', 'p2', WORKOUT)).toEqual({});
  });

  it('keeps one mission’s plan out of another’s', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    expect(readScalingPlan('m2', 'p1', WORKOUT)).toEqual({});
  });

  it('drops a scaling for a movement no longer in the workout', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    expect(readScalingPlan('m1', 'p1', [{ name: 'Air Squats' }])).toEqual({});
  });

  it('drops an option the movement does not offer', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'squat--box' });
    expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({});
  });

  it('clears rather than storing an empty selection', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    writeScalingPlan('m1', 'p1', {});
    expect(window.localStorage.getItem(scalingPlanStorageKey('m1', 'p1'))).toBeNull();
    expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({});
  });

  it('clears a plan once the result is submitted', () => {
    writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' });
    clearScalingPlan('m1', 'p1');
    expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({});
  });

  it('returns nothing for a corrupt stored value', () => {
    window.localStorage.setItem(scalingPlanStorageKey('m1', 'p1'), 'not json');
    expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({});
  });

  it('evicts the oldest plans past the cap, keeping the newest', () => {
    for (let index = 0; index < MAX_STORED_PLANS + 5; index += 1) {
      writeScalingPlan(`m${index}`, 'p1', { 'Diamond Push-ups': 'push-up--knees' }, 1000 + index);
    }
    pruneScalingPlans();

    const surviving = Object.keys(window.localStorage).filter((key) =>
      key.startsWith('amrapScalingPlan:')
    );
    expect(surviving).toHaveLength(MAX_STORED_PLANS);
    expect(surviving).toContain(scalingPlanStorageKey(`m${MAX_STORED_PLANS + 4}`, 'p1'));
    expect(surviving).not.toContain(scalingPlanStorageKey('m0', 'p1'));
  });

  it('does not throw when storage is unavailable', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(() =>
        writeScalingPlan('m1', 'p1', { 'Diamond Push-ups': 'push-up--knees' })
      ).not.toThrow();
      // The in-memory fallback still carries the plan for this page view.
      expect(readScalingPlan('m1', 'p1', WORKOUT)).toEqual({
        'Diamond Push-ups': 'push-up--knees',
      });
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    }
  });
});
