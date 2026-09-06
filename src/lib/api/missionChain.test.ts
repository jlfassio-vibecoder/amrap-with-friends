import { describe, expect, it } from 'vitest';
import { toMissionChainRpcItems } from './missionChain';

describe('toMissionChainRpcItems', () => {
  it('maps fields to snake_case and stamps started_mission_id on position 0 only', () => {
    expect(
      toMissionChainRpcItems([
        {
          durationMinutes: 10,
          workout: [{ name: 'Burpees', target: 10 }],
          templateId: 'the-piston',
          intensityTier: 3,
          startedMissionId: '11111111-1111-4111-8111-111111111111',
        },
        {
          durationMinutes: 5,
          workout: [{ name: 'Air Squats', target: 15 }],
          templateId: 'the-metronome',
          intensityTier: 3,
          startedMissionId: 'should-be-ignored',
        },
      ])
    ).toEqual([
      {
        duration_minutes: 10,
        workout: [{ name: 'Burpees', target: 10 }],
        template_id: 'the-piston',
        intensity_tier: 3,
        started_mission_id: '11111111-1111-4111-8111-111111111111',
      },
      {
        duration_minutes: 5,
        workout: [{ name: 'Air Squats', target: 15 }],
        template_id: 'the-metronome',
        intensity_tier: 3,
      },
    ]);
  });
});
