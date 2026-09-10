import { describe, expect, it } from 'vitest';
import { AMQAP_FLOWS } from '@/data/amqapFlows';
import { templateToExercises, exercisesToWorkoutText } from '@/lib/workout/templateToExercises';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';

describe('AMQAP hip-control scorability', () => {
  const flow = AMQAP_FLOWS.find((entry) => entry.id === 'amqap-hip-control-15')!;

  it('direct templateToExercises is scorable', () => {
    const direct = templateToExercises(flow);
    expect(computeRepsPerRound(direct)).toBeGreaterThan(0);
  });

  it('CreateMission text round-trip stays scorable', () => {
    const text = exercisesToWorkoutText(templateToExercises(flow));
    const parsed = parseWorkoutText(text);
    expect(parsed).toEqual(templateToExercises(flow));
    expect(computeRepsPerRound(parsed)).toBe(computeRepsPerRound(templateToExercises(flow)));
  });
});
