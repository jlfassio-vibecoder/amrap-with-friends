import { describe, expect, it } from 'vitest';
import { shouldUseMissionRealtimeTables } from './shouldUseMissionRealtimeTables';

describe('shouldUseMissionRealtimeTables', () => {
  it('uses Realtime for signed-in athletes without a claim token', () => {
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: true, hasClaimToken: false })).toBe(
      true
    );
  });

  it('polls when a claim token is present, even if signed in', () => {
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: true, hasClaimToken: true })).toBe(
      false
    );
  });

  it('polls for anonymous guests', () => {
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: false, hasClaimToken: true })).toBe(
      false
    );
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: false, hasClaimToken: false })).toBe(
      false
    );
  });
});
