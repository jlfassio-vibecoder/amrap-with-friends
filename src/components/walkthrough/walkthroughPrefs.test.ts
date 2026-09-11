import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissWalkthroughForever,
  isWalkthroughCompleteForMission,
  isWalkthroughDismissed,
  markWalkthroughCompleteForMission,
  resetWalkthroughPrefs,
  walkthroughMissionCompleteKey,
  walkthroughStorageKey,
} from './walkthroughPrefs';

afterEach(() => {
  resetWalkthroughPrefs();
});

describe('walkthroughPrefs', () => {
  it('starts undismissed for each role', () => {
    expect(isWalkthroughDismissed('host')).toBe(false);
    expect(isWalkthroughDismissed('joiner')).toBe(false);
  });

  it('persists forever-dismiss per role', () => {
    dismissWalkthroughForever('host');

    expect(isWalkthroughDismissed('host')).toBe(true);
    expect(isWalkthroughDismissed('joiner')).toBe(false);
    expect(walkthroughStorageKey('host')).toBe('amrap_rally_point_walkthrough_v1_host');
  });

  it('does not treat joiner dismiss as host dismiss', () => {
    dismissWalkthroughForever('joiner');

    expect(isWalkthroughDismissed('joiner')).toBe(true);
    expect(isWalkthroughDismissed('host')).toBe(false);
  });

  it('persists completion per mission without forever-dismissing the role', () => {
    markWalkthroughCompleteForMission('mission-a', 'host');

    expect(isWalkthroughCompleteForMission('mission-a', 'host')).toBe(true);
    expect(isWalkthroughCompleteForMission('mission-b', 'host')).toBe(false);
    expect(isWalkthroughDismissed('host')).toBe(false);
    expect(walkthroughMissionCompleteKey('mission-a', 'host')).toBe(
      'amrap_rally_point_walkthrough_v1_mission_host_mission-a'
    );
  });
});
