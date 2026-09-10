import { describe, expect, it } from 'vitest';
import { AMQAP_FLOWS, findAmqapFlow } from '@/data/amqapFlows';
import { expandAmqapSets } from './expandAmqapSets';

function flow(id: string) {
  const found = findAmqapFlow(id);
  if (!found) {
    throw new Error(`missing flow ${id}`);
  }
  return found;
}

describe('findAmqapFlow', () => {
  it('looks up the catalog by template id', () => {
    expect(findAmqapFlow('amqap-foundational-10')?.flowId).toBe('foundational');
    expect(findAmqapFlow('the-hull-breach')).toBeUndefined();
    expect(findAmqapFlow(null)).toBeUndefined();
  });
});

describe('expandAmqapSets', () => {
  it('splits per-side work and keeps bilateral work as one set', () => {
    const sets = expandAmqapSets(flow('amqap-foundational-10'));
    expect(sets).toEqual([
      {
        movementIndex: 0,
        movementName: '90/90 Hip Transitions',
        side: 'left',
        durationSec: 25,
        isLastOfRound: false,
        repsPerSet: 5,
        leadBufferSec: 0,
      },
      {
        movementIndex: 0,
        movementName: '90/90 Hip Transitions',
        side: 'right',
        durationSec: 25,
        isLastOfRound: false,
        repsPerSet: 5,
        leadBufferSec: 0,
      },
      {
        movementIndex: 1,
        movementName: 'Spiderman Lunge with Thoracic Reach',
        side: 'left',
        durationSec: 30,
        isLastOfRound: false,
        repsPerSet: 5,
        leadBufferSec: 5,
      },
      {
        movementIndex: 1,
        movementName: 'Spiderman Lunge with Thoracic Reach',
        side: 'right',
        durationSec: 30,
        isLastOfRound: false,
        repsPerSet: 5,
        leadBufferSec: 0,
      },
      {
        movementIndex: 2,
        movementName: 'Downward-Facing Dog to Cobra',
        side: null,
        durationSec: 30,
        isLastOfRound: true,
        repsPerSet: 5,
        leadBufferSec: 0,
      },
    ]);
  });

  it('treats a per-side hold as two timed sets', () => {
    const sets = expandAmqapSets(flow('amqap-deep-hip-10'));
    expect(sets.filter((set) => set.movementName === 'Pigeon Pose')).toEqual([
      {
        movementIndex: 1,
        movementName: 'Pigeon Pose',
        side: 'left',
        durationSec: 20,
        isLastOfRound: false,
        repsPerSet: null,
        leadBufferSec: 5,
      },
      {
        movementIndex: 1,
        movementName: 'Pigeon Pose',
        side: 'right',
        durationSec: 20,
        isLastOfRound: false,
        repsPerSet: null,
        leadBufferSec: 0,
      },
    ]);
    expect(sets[sets.length - 1]).toMatchObject({
      movementName: 'Cobra Pose',
      side: null,
      durationSec: 25,
      isLastOfRound: true,
    });
  });

  it('uses the same program at 10 and 15', () => {
    for (const ten of AMQAP_FLOWS.filter((entry) => entry.durationMinutes === 10)) {
      const fifteen = findAmqapFlow(`amqap-${ten.flowId}-15`);
      expect(expandAmqapSets(ten)).toEqual(expandAmqapSets(fifteen!));
    }
  });

  it('marks only the last set of the last exercise', () => {
    const hip = expandAmqapSets(flow('amqap-hip-control-10'));
    expect(hip.filter((set) => set.isLastOfRound)).toHaveLength(1);
    expect(hip[hip.length - 1]).toMatchObject({
      movementName: 'Half Moon Pose',
      side: 'right',
      durationSec: 15,
      isLastOfRound: true,
      repsPerSet: null,
      leadBufferSec: 0,
    });
  });

  it('adds a 5s switch buffer only on the first side of a later per-side movement', () => {
    const lead = (id: string) =>
      expandAmqapSets(flow(id)).map((set) => ({
        name: set.movementName,
        side: set.side,
        leadBufferSec: set.leadBufferSec,
      }));

    expect(lead('amqap-foundational-10')).toEqual([
      { name: '90/90 Hip Transitions', side: 'left', leadBufferSec: 0 },
      { name: '90/90 Hip Transitions', side: 'right', leadBufferSec: 0 },
      { name: 'Spiderman Lunge with Thoracic Reach', side: 'left', leadBufferSec: 5 },
      { name: 'Spiderman Lunge with Thoracic Reach', side: 'right', leadBufferSec: 0 },
      { name: 'Downward-Facing Dog to Cobra', side: null, leadBufferSec: 0 },
    ]);

    expect(lead('amqap-hip-control-10')).toEqual([
      { name: 'Quadruped Hip Circles', side: 'left', leadBufferSec: 0 },
      { name: 'Quadruped Hip Circles', side: 'right', leadBufferSec: 0 },
      { name: 'Low Lunge', side: 'left', leadBufferSec: 5 },
      { name: 'Low Lunge', side: 'right', leadBufferSec: 0 },
      { name: 'Half Moon Pose', side: 'left', leadBufferSec: 5 },
      { name: 'Half Moon Pose', side: 'right', leadBufferSec: 0 },
    ]);

    expect(lead('amqap-spinal-10')).toEqual([
      { name: 'Prone Internal Rotation Windshield Wipers', side: null, leadBufferSec: 0 },
      { name: 'Cobra Pose', side: null, leadBufferSec: 0 },
      { name: "Child's Pose", side: null, leadBufferSec: 0 },
    ]);

    expect(lead('amqap-posterior-10')).toEqual([
      { name: 'Cat & Cow', side: null, leadBufferSec: 0 },
      { name: 'Downward-Facing Dog', side: null, leadBufferSec: 0 },
      { name: 'Low Lunge', side: 'left', leadBufferSec: 5 },
      { name: 'Low Lunge', side: 'right', leadBufferSec: 0 },
      { name: 'Camel Pose', side: null, leadBufferSec: 0 },
    ]);
  });
});
