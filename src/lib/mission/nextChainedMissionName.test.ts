import { describe, expect, it } from 'vitest';
import type { MissionChainItem } from '@/lib/api/missionChain';
import { nextChainedMissionName } from './nextChainedMissionName';

function item(
  overrides: Partial<MissionChainItem> & Pick<MissionChainItem, 'id' | 'position'>
): MissionChainItem {
  return {
    durationMinutes: 5,
    workout: [],
    templateId: null,
    intensityTier: 3,
    startedMissionId: null,
    ...overrides,
  };
}

describe('nextChainedMissionName', () => {
  it('returns null for an empty or single-item queue', () => {
    expect(nextChainedMissionName([])).toBeNull();
    expect(
      nextChainedMissionName([
        item({ id: 'a', position: 0, templateId: 'the-piston', startedMissionId: 'm1' }),
      ])
    ).toBeNull();
  });

  it('returns the template name of the first unstarted item', () => {
    expect(
      nextChainedMissionName([
        item({ id: 'a', position: 0, templateId: 'the-piston', startedMissionId: 'm1' }),
        item({ id: 'b', position: 1, templateId: 'the-metronome', startedMissionId: null }),
      ])
    ).toBe('The Metronome');
  });

  it('returns null when every item has started', () => {
    expect(
      nextChainedMissionName([
        item({ id: 'a', position: 0, templateId: 'the-piston', startedMissionId: 'm1' }),
        item({ id: 'b', position: 1, templateId: 'the-metronome', startedMissionId: 'm2' }),
      ])
    ).toBeNull();
  });

  it('falls back to Workout when the template id is unknown', () => {
    expect(
      nextChainedMissionName([
        item({ id: 'a', position: 0, templateId: 'the-piston', startedMissionId: 'm1' }),
        item({ id: 'b', position: 1, templateId: 'not-a-real-template', startedMissionId: null }),
      ])
    ).toBe('Workout');
  });
});
