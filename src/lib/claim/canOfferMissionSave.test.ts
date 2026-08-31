import { describe, it, expect } from 'vitest';
import { canOfferMissionSave } from './canOfferMissionSave';

describe('canOfferMissionSave', () => {
  it('returns true for guest with claim token and claimable status', () => {
    expect(
      canOfferMissionSave({
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimable',
      })
    ).toBe(true);
  });

  it('returns true when not authenticated but status is unknown', () => {
    expect(
      canOfferMissionSave({
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'unknown',
      })
    ).toBe(true);
  });

  it('returns false when already claimed', () => {
    expect(
      canOfferMissionSave({
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimed',
      })
    ).toBe(false);
  });

  it('returns false when claimed by another account', () => {
    expect(
      canOfferMissionSave({
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimed_by_other',
      })
    ).toBe(false);
  });

  it('returns false without claim token', () => {
    expect(
      canOfferMissionSave({
        claimToken: null,
        participantId: 'participant-id',
        claimStatus: 'claimable',
      })
    ).toBe(false);
  });
});
