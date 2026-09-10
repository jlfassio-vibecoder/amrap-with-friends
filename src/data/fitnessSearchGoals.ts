/**
 * Global fitness search goal taxonomy — adapted from the search-categories
 * infographic (top macros → Category Explorer leaf goals).
 */

export type FitnessSearchGoalId =
  | 'weight-loss'
  | 'muscle-building'
  | 'abs-spot'
  | 'cardio-stamina'
  | 'strength-power'
  | 'mobility-posture';

export type FitnessSearchTopId = 'weight-loss' | 'muscle-building' | 'cardio-power' | 'flexibility';

export type FitnessSearchTopFilter = FitnessSearchTopId | 'all';
export type FitnessSearchGoalFilter = FitnessSearchGoalId | 'all';

export type FitnessSearchGoal = {
  id: FitnessSearchGoalId;
  label: string;
  topId: FitnessSearchTopId;
};

export type FitnessSearchTop = {
  id: FitnessSearchTopId;
  label: string;
  subIds: readonly FitnessSearchGoalId[];
};

export const FITNESS_SEARCH_GOALS: readonly FitnessSearchGoal[] = [
  { id: 'weight-loss', label: 'Weight Loss & Fat Burning', topId: 'weight-loss' },
  { id: 'muscle-building', label: 'Muscle Building & Toning', topId: 'muscle-building' },
  { id: 'abs-spot', label: 'Abs & Spot Targets', topId: 'muscle-building' },
  { id: 'cardio-stamina', label: 'Cardio & Stamina', topId: 'cardio-power' },
  { id: 'strength-power', label: 'Strength & Power', topId: 'cardio-power' },
  { id: 'mobility-posture', label: 'Mobility & Posture', topId: 'flexibility' },
];

export const FITNESS_SEARCH_TOPS: readonly FitnessSearchTop[] = [
  {
    id: 'weight-loss',
    label: 'Weight Loss & Fat Burning',
    subIds: ['weight-loss'],
  },
  {
    id: 'muscle-building',
    label: 'Muscle Building & Toning',
    subIds: ['muscle-building', 'abs-spot'],
  },
  {
    id: 'cardio-power',
    label: 'Cardio, Stamina & Power',
    subIds: ['cardio-stamina', 'strength-power'],
  },
  {
    id: 'flexibility',
    label: 'Flexibility & Posture',
    subIds: ['mobility-posture'],
  },
];

const GOAL_BY_ID = new Map(FITNESS_SEARCH_GOALS.map((goal) => [goal.id, goal]));

export function fitnessSearchGoalById(id: FitnessSearchGoalId): FitnessSearchGoal {
  const goal = GOAL_BY_ID.get(id);
  if (!goal) {
    throw new Error(`Unknown fitness search goal: ${id}`);
  }
  return goal;
}

export function subsForTop(top: FitnessSearchTopFilter): readonly FitnessSearchGoal[] {
  if (top === 'all') {
    return FITNESS_SEARCH_GOALS;
  }
  const entry = FITNESS_SEARCH_TOPS.find((item) => item.id === top);
  if (!entry) {
    return [];
  }
  return entry.subIds.map((id) => fitnessSearchGoalById(id));
}

/** True when a preset's tags match the selected top + focus filters. */
export function presetMatchesGoalFilter(
  presetGoals: readonly FitnessSearchGoalId[],
  top: FitnessSearchTopFilter,
  sub: FitnessSearchGoalFilter
): boolean {
  if (top === 'all') {
    return true;
  }
  if (sub !== 'all') {
    return presetGoals.includes(sub);
  }
  const allowed = new Set(subsForTop(top).map((goal) => goal.id));
  return presetGoals.some((goal) => allowed.has(goal));
}
