import { describe, expect, it } from 'vitest';
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
      { name: '90/90 Hip Transitions (5/side)', reps: 10 },
      { name: 'Spiderman Lunge with Thoracic Reach (5/side)', reps: 10 },
      { name: 'Downward-Facing Dog to Cobra', reps: 5 },
    ]);

    const hip = flow('amqap-hip-control-10')!.movements;
    expect(hip).toEqual([
      { name: 'Quadruped Hip Circles (5/side)', reps: 10 },
      { name: 'Low Lunge (5/side)', reps: 10 },
      { name: 'Half Moon Pose (15-Sec/side)', reps: 30, unit: 'sec' },
    ]);

    const spinal = flow('amqap-spinal-10')!.movements;
    expect(spinal).toEqual([
      { name: 'Prone Internal Rotation Windshield Wipers', reps: 10 },
      { name: 'Cobra Pose', reps: 5 },
      { name: "Child's Pose", reps: 20, unit: 'sec' },
    ]);

    const posterior = flow('amqap-posterior-10')!.movements;
    expect(posterior).toEqual([
      { name: 'Cat & Cow', reps: 8 },
      { name: 'Downward-Facing Dog', reps: 20, unit: 'sec' },
      { name: 'Low Lunge (5/side)', reps: 10 },
      { name: 'Camel Pose', reps: 20, unit: 'sec' },
    ]);

    const deepHip = flow('amqap-deep-hip-10')!.movements;
    expect(deepHip).toEqual([
      { name: 'Downward-Facing Dog', reps: 20, unit: 'sec' },
      { name: 'Pigeon Pose (20-Sec/side)', reps: 40, unit: 'sec' },
      { name: '90/90 Hip Internal Rotation Lift (5/side)', reps: 10 },
      { name: 'Cobra Pose', reps: 5 },
    ]);
  });
});
