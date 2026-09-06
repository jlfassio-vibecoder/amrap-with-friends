import { describe, expect, it } from 'vitest';
import type { MissionChainItem } from '@/lib/api/missionChain';
import {
  chainHasUnstartedItems,
  chainPlanSummaryForMission,
  chainRestBannerForMission,
  formatChainPlanSummary,
  formatChainRestBanner,
} from './chainAdvanceCopy';

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

describe('formatChainRestBanner', () => {
  it('formats mission n of total from position and remaining', () => {
    expect(formatChainRestBanner(1, 2)).toBe(
      'Rest — mission 2 of 4 starts when the host is ready.'
    );
  });
});

describe('formatChainPlanSummary', () => {
  it('returns null for fewer than two items', () => {
    expect(formatChainPlanSummary([])).toBeNull();
    expect(formatChainPlanSummary([item({ id: 'a', position: 0 })])).toBeNull();
  });

  it('summarises count and approximate minutes', () => {
    const summary = formatChainPlanSummary([
      item({ id: 'a', position: 0, durationMinutes: 5, intensityTier: 3 }),
      item({ id: 'b', position: 1, durationMinutes: 5, intensityTier: 3 }),
    ]);
    expect(summary).toMatch(/^2 missions · about \d+ min$/);
  });
});

describe('chainHasUnstartedItems', () => {
  it('is true when any started_mission_id is null', () => {
    expect(
      chainHasUnstartedItems([
        item({ id: 'a', position: 0, startedMissionId: 'm1' }),
        item({ id: 'b', position: 1, startedMissionId: null }),
      ])
    ).toBe(true);
    expect(
      chainHasUnstartedItems([
        item({ id: 'a', position: 0, startedMissionId: 'm1' }),
        item({ id: 'b', position: 1, startedMissionId: 'm2' }),
      ])
    ).toBe(false);
  });
});

describe('chainRestBannerForMission', () => {
  it('returns null on mission 1', () => {
    expect(
      chainRestBannerForMission(
        [
          item({ id: 'a', position: 0, startedMissionId: 'm1' }),
          item({ id: 'b', position: 1, startedMissionId: null }),
        ],
        'm1'
      )
    ).toBeNull();
  });

  it('formats from current position and unstarted count', () => {
    expect(
      chainRestBannerForMission(
        [
          item({ id: 'a', position: 0, startedMissionId: 'm1' }),
          item({ id: 'b', position: 1, startedMissionId: 'm2' }),
          item({ id: 'c', position: 2, startedMissionId: null }),
          item({ id: 'd', position: 3, startedMissionId: null }),
        ],
        'm2'
      )
    ).toBe('Rest — mission 2 of 4 starts when the host is ready.');
  });
});

describe('chainPlanSummaryForMission', () => {
  it('only summarises on position 0', () => {
    const items = [
      item({ id: 'a', position: 0, startedMissionId: 'm1', durationMinutes: 5 }),
      item({ id: 'b', position: 1, startedMissionId: null, durationMinutes: 5 }),
    ];
    expect(chainPlanSummaryForMission(items, 'm1')).toMatch(/^2 missions · about \d+ min$/);
    expect(chainPlanSummaryForMission(items, 'm2')).toBeNull();
  });
});
