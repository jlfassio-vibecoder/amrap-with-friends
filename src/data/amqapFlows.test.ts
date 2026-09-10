import { describe, expect, it } from 'vitest';
import { getExerciseInfo } from '@/data/exerciseLibrary';
import { templateToExercises } from '@/lib/workout/templateToExercises';
import { AMQAP_FLOWS } from './amqapFlows';

function flow(id: string) {
  return AMQAP_FLOWS.find((entry) => entry.id === id);
}

describe('AMQAP quality-round prescriptions', () => {
  it('gives every movement a dose, and the same pass at 10 and 15', () => {
    for (const entry of AMQAP_FLOWS) {
      expect(entry.movements.length).toBeGreaterThan(0);
      expect(entry.movements.every((movement) => movement.reps !== undefined)).toBe(true);
    }

    const ten = flow('amqap-foundational-10')?.movements;
    const fifteen = flow('amqap-foundational-15')?.movements;
    expect(ten).toEqual(fifteen);
  });

  it('splits unilateral work per side and keeps sagittal work as cycles or holds', () => {
    const foundational = flow('amqap-foundational-10')!.movements;
    expect(foundational).toEqual([
      {
        name: '90/90 Hip Transitions (5/side)',
        displayName: '90/90 Hip Transitions',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 25,
      },
      {
        name: 'Spiderman Lunge with Thoracic Reach (5/side)',
        displayName: 'Spiderman Lunge with Thoracic Reach',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 30,
      },
      {
        name: 'Downward-Facing Dog to Cobra',
        displayName: 'Downward-Facing Dog to Cobra',
        reps: 5,
        laterality: 'bilateral',
        durationSecPerSet: 30,
      },
    ]);

    const hip = flow('amqap-hip-control-10')!.movements;
    expect(hip).toEqual([
      {
        name: 'Quadruped Hip Circles (5/side)',
        displayName: 'Quadruped Hip Circles',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 25,
      },
      {
        name: 'Low Lunge (5/side)',
        displayName: 'Low Lunge',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 25,
      },
      {
        name: 'Half Moon Pose (15-Sec/side)',
        displayName: 'Half Moon Pose',
        reps: 30,
        unit: 'sec',
        laterality: 'per-side',
        durationSecPerSet: 15,
      },
    ]);

    const spinal = flow('amqap-spinal-10')!.movements;
    expect(spinal).toEqual([
      {
        name: 'Prone Internal Rotation Windshield Wipers',
        displayName: 'Prone Internal Rotation Windshield Wipers',
        reps: 10,
        laterality: 'bilateral',
        durationSecPerSet: 40,
      },
      {
        name: 'Cobra Pose',
        displayName: 'Cobra Pose',
        reps: 5,
        laterality: 'bilateral',
        durationSecPerSet: 25,
      },
      {
        name: "Child's Pose",
        displayName: "Child's Pose",
        reps: 20,
        unit: 'sec',
        laterality: 'bilateral',
        durationSecPerSet: 20,
      },
    ]);

    const posterior = flow('amqap-posterior-10')!.movements;
    expect(posterior).toEqual([
      {
        name: 'Cat & Cow',
        displayName: 'Cat & Cow',
        reps: 8,
        laterality: 'bilateral',
        durationSecPerSet: 32,
      },
      {
        name: 'Downward-Facing Dog',
        displayName: 'Downward-Facing Dog',
        reps: 20,
        unit: 'sec',
        laterality: 'bilateral',
        durationSecPerSet: 20,
      },
      {
        name: 'Low Lunge (5/side)',
        displayName: 'Low Lunge',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 25,
      },
      {
        name: 'Camel Pose',
        displayName: 'Camel Pose',
        reps: 20,
        unit: 'sec',
        laterality: 'bilateral',
        durationSecPerSet: 20,
      },
    ]);

    const deepHip = flow('amqap-deep-hip-10')!.movements;
    expect(deepHip).toEqual([
      {
        name: 'Downward-Facing Dog',
        displayName: 'Downward-Facing Dog',
        reps: 20,
        unit: 'sec',
        laterality: 'bilateral',
        durationSecPerSet: 20,
      },
      {
        name: 'Pigeon Pose (20-Sec/side)',
        displayName: 'Pigeon Pose',
        reps: 40,
        unit: 'sec',
        laterality: 'per-side',
        durationSecPerSet: 20,
      },
      {
        name: '90/90 Hip Internal Rotation Lift (5/side)',
        displayName: '90/90 Hip Internal Rotation Lift',
        reps: 10,
        laterality: 'per-side',
        durationSecPerSet: 25,
      },
      {
        name: 'Cobra Pose',
        displayName: 'Cobra Pose',
        reps: 5,
        laterality: 'bilateral',
        durationSecPerSet: 25,
      },
    ]);
  });

  it('does not leak set-program fields into mission workout jsonb', () => {
    const exercises = templateToExercises(flow('amqap-foundational-10')!);
    expect(exercises).toEqual([
      { name: '90/90 Hip Transitions (5/side)', target: 10, unit: 'reps' },
      { name: 'Spiderman Lunge with Thoracic Reach (5/side)', target: 10, unit: 'reps' },
      { name: 'Downward-Facing Dog to Cobra', target: 5, unit: 'reps' },
    ]);
    expect(JSON.stringify(exercises)).not.toContain('laterality');
    expect(JSON.stringify(exercises)).not.toContain('durationSecPerSet');
  });

  it('resolves a How-to entry for every programmed movement', () => {
    const names = new Set(
      AMQAP_FLOWS.flatMap((entry) => entry.movements.map((movement) => movement.name))
    );
    for (const name of names) {
      expect(getExerciseInfo(name), name).toBeTruthy();
    }
  });
});
