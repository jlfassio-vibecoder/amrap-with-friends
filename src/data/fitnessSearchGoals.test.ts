import { describe, expect, it } from 'vitest';
import {
  FITNESS_SEARCH_GOALS,
  FITNESS_SEARCH_TOPS,
  fitnessSearchGoalById,
  presetMatchesGoalFilter,
  subsForTop,
} from './fitnessSearchGoals';

describe('fitnessSearchGoals', () => {
  it('nests six leaf goals under four top categories', () => {
    expect(FITNESS_SEARCH_TOPS).toHaveLength(4);
    expect(FITNESS_SEARCH_GOALS).toHaveLength(6);
    const nested = FITNESS_SEARCH_TOPS.flatMap((top) => [...top.subIds]);
    expect(new Set(nested).size).toBe(6);
    expect(nested).toHaveLength(6);
  });

  it('lists subs for a selected top', () => {
    expect(subsForTop('all')).toHaveLength(6);
    expect(subsForTop('muscle-building').map((goal) => goal.id)).toEqual([
      'muscle-building',
      'abs-spot',
    ]);
    expect(subsForTop('flexibility').map((goal) => goal.label)).toEqual(['Mobility & Posture']);
  });

  it('matches presets against top and focus filters', () => {
    const goals = ['weight-loss', 'cardio-stamina'] as const;
    expect(presetMatchesGoalFilter(goals, 'all', 'all')).toBe(true);
    expect(presetMatchesGoalFilter(goals, 'weight-loss', 'all')).toBe(true);
    expect(presetMatchesGoalFilter(goals, 'weight-loss', 'weight-loss')).toBe(true);
    expect(presetMatchesGoalFilter(goals, 'cardio-power', 'all')).toBe(true);
    expect(presetMatchesGoalFilter(goals, 'cardio-power', 'strength-power')).toBe(false);
    expect(presetMatchesGoalFilter(goals, 'flexibility', 'all')).toBe(false);
    expect(presetMatchesGoalFilter(['abs-spot'], 'muscle-building', 'abs-spot')).toBe(true);
  });

  it('resolves every goal id', () => {
    for (const goal of FITNESS_SEARCH_GOALS) {
      expect(fitnessSearchGoalById(goal.id)).toEqual(goal);
    }
  });
});
