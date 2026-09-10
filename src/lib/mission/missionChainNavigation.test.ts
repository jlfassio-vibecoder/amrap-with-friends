import { describe, it, expect } from 'vitest';
import {
  shouldAdvanceMissionChain,
  shouldPullViewerToActiveMission,
  type ChainAdvanceDecisionInput,
  type ForceNavDecisionInput,
} from '@/lib/mission/missionChainNavigation';

const nav = (overrides: Partial<ForceNavDecisionInput> = {}): ForceNavDecisionInput => ({
  rallyPointId: 'hub-1',
  livePhase: 'finished',
  isHost: false,
  currentMissionId: 'm1',
  activeMissionId: 'm2',
  activeMissionState: 'waiting',
  nextChainedMissionId: null,
  showPartialRepsModal: false,
  showScorecard: false,
  ...overrides,
});

const advance = (
  overrides: Partial<ChainAdvanceDecisionInput> = {}
): ChainAdvanceDecisionInput => ({
  isHost: true,
  isPractice: false,
  livePhase: 'finished',
  rallyPointId: 'hub-1',
  isAuthenticated: true,
  currentMissionId: 'm1',
  activeMissionId: 'm1',
  attemptedForMissionId: null,
  scoreLocked: true,
  ...overrides,
});

describe('shouldPullViewerToActiveMission', () => {
  it('never navigates a joiner out of partial-rep entry', () => {
    // The regression this function exists for: the entry is discarded and the
    // athlete's result for this mission is never submitted.
    expect(
      shouldPullViewerToActiveMission(
        nav({ showPartialRepsModal: true, nextChainedMissionId: 'm2' })
      )
    ).toBe(false);
    expect(
      shouldPullViewerToActiveMission(nav({ showScorecard: true, nextChainedMissionId: 'm2' }))
    ).toBe(false);
  });

  it('never navigates a viewer out of result entry even with no chain in play', () => {
    expect(shouldPullViewerToActiveMission(nav({ showPartialRepsModal: true }))).toBe(false);
    expect(shouldPullViewerToActiveMission(nav({ showScorecard: true }))).toBe(false);
  });

  it('pulls stragglers on after the after-action review', () => {
    expect(shouldPullViewerToActiveMission(nav())).toBe(true);
    expect(shouldPullViewerToActiveMission(nav({ isHost: true }))).toBe(true);
  });

  it('pulls joiners across once a chain advance has gone live', () => {
    expect(
      shouldPullViewerToActiveMission(
        nav({ nextChainedMissionId: 'm2', activeMissionId: 'm2', activeMissionState: 'work' })
      )
    ).toBe(true);
  });

  it('leaves the host on their Continue button', () => {
    expect(
      shouldPullViewerToActiveMission(
        nav({ isHost: true, nextChainedMissionId: 'm2', activeMissionId: 'm2' })
      )
    ).toBe(false);
  });

  it('waits for the next mission to actually be live', () => {
    expect(
      shouldPullViewerToActiveMission(
        nav({ nextChainedMissionId: 'm2', activeMissionId: 'm2', activeMissionState: 'finished' })
      )
    ).toBe(false);
  });

  it('pulls a viewer whose page is stale before and during work', () => {
    for (const livePhase of ['waiting', 'setup', 'work'] as const) {
      expect(shouldPullViewerToActiveMission(nav({ livePhase }))).toBe(true);
      expect(shouldPullViewerToActiveMission(nav({ livePhase, activeMissionId: 'm1' }))).toBe(
        false
      );
      expect(shouldPullViewerToActiveMission(nav({ livePhase, activeMissionId: null }))).toBe(
        false
      );
    }
  });

  it('does nothing outside a hub', () => {
    expect(shouldPullViewerToActiveMission(nav({ rallyPointId: null }))).toBe(false);
  });
});

describe('shouldAdvanceMissionChain', () => {
  it('advances from the mission the hub is on', () => {
    expect(shouldAdvanceMissionChain(advance())).toBe(true);
  });

  it('refuses to advance from a mission the hub has moved past', () => {
    // Reopening mission 2 of an abandoned chain from My Missions must not
    // launch mission 3 and drag the hub along with it.
    expect(shouldAdvanceMissionChain(advance({ activeMissionId: 'm4' }))).toBe(false);
  });

  it('refuses while the hub row has not arrived yet', () => {
    expect(shouldAdvanceMissionChain(advance({ activeMissionId: null }))).toBe(false);
    expect(shouldAdvanceMissionChain(advance({ activeMissionId: undefined }))).toBe(false);
  });

  it('is host-only, live-only and signed-in only', () => {
    expect(shouldAdvanceMissionChain(advance({ isHost: false }))).toBe(false);
    expect(shouldAdvanceMissionChain(advance({ isPractice: true }))).toBe(false);
    expect(shouldAdvanceMissionChain(advance({ isAuthenticated: false }))).toBe(false);
    expect(shouldAdvanceMissionChain(advance({ rallyPointId: null }))).toBe(false);
    for (const livePhase of ['waiting', 'setup', 'work'] as const) {
      expect(shouldAdvanceMissionChain(advance({ livePhase }))).toBe(false);
    }
  });

  it('does not attempt the same mission twice', () => {
    expect(shouldAdvanceMissionChain(advance({ attemptedForMissionId: 'm1' }))).toBe(false);
    expect(shouldAdvanceMissionChain(advance({ attemptedForMissionId: 'm0' }))).toBe(true);
  });

  it('waits until the host score is locked', () => {
    expect(shouldAdvanceMissionChain(advance({ scoreLocked: false }))).toBe(false);
  });
});
