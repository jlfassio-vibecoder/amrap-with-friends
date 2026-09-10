import { describe, expect, it } from 'vitest';
import {
  shouldCloseMissionLockedModal,
  shouldShowMissionLockedModal,
} from '@/lib/mission/shouldShowMissionLockedModal';

describe('shouldShowMissionLockedModal', () => {
  it('opens on the transition from waiting into setup', () => {
    expect(
      shouldShowMissionLockedModal({ prevPhase: 'waiting', nextPhase: 'setup', isPractice: false })
    ).toBe(true);
  });

  it('does not open on a first paint that already lands in setup', () => {
    // A participant who opens the rally link after Start was pressed sees
    // 'setup' on their very first render — that is a page load, not a
    // transition, and must not pop the modal for them mid-countdown.
    expect(
      shouldShowMissionLockedModal({ prevPhase: null, nextPhase: 'setup', isPractice: false })
    ).toBe(false);
  });

  it('does not re-open while already sitting in setup', () => {
    expect(
      shouldShowMissionLockedModal({ prevPhase: 'setup', nextPhase: 'setup', isPractice: false })
    ).toBe(false);
  });

  it('does not open on the transition into work', () => {
    expect(
      shouldShowMissionLockedModal({ prevPhase: 'setup', nextPhase: 'work', isPractice: false })
    ).toBe(false);
  });

  it('never opens during practice', () => {
    // "The squad has left the Rally Point" is false for a solo rehearsal.
    expect(
      shouldShowMissionLockedModal({ prevPhase: 'waiting', nextPhase: 'setup', isPractice: true })
    ).toBe(false);
  });
});

describe('shouldCloseMissionLockedModal', () => {
  it('closes once setup ends', () => {
    expect(shouldCloseMissionLockedModal('work')).toBe(true);
  });

  it('stays open while still in setup', () => {
    expect(shouldCloseMissionLockedModal('setup')).toBe(false);
  });
});
