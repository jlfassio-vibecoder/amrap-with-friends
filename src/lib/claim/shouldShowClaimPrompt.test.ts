import { describe, it, expect } from 'vitest';
import { shouldShowClaimPrompt } from './shouldShowClaimPrompt';

describe('shouldShowClaimPrompt', () => {
  it('returns true when authenticated with claim token and claimable status', () => {
    expect(
      shouldShowClaimPrompt({
        isAuthenticated: true,
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimable',
      })
    ).toBe(true);
  });

  it('returns false when not authenticated', () => {
    expect(
      shouldShowClaimPrompt({
        isAuthenticated: false,
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimable',
      })
    ).toBe(false);
  });

  it('returns false when already claimed', () => {
    expect(
      shouldShowClaimPrompt({
        isAuthenticated: true,
        claimToken: 'token',
        participantId: 'participant-id',
        claimStatus: 'claimed',
      })
    ).toBe(false);
  });

  it('returns false without claim token', () => {
    expect(
      shouldShowClaimPrompt({
        isAuthenticated: true,
        claimToken: null,
        participantId: 'participant-id',
        claimStatus: 'claimable',
      })
    ).toBe(false);
  });
});
