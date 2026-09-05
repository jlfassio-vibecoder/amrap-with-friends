import { describe, expect, it } from 'vitest';
import { shouldUseMissionRealtimeTables } from './shouldUseMissionRealtimeTables';

describe('shouldUseMissionRealtimeTables', () => {
  it('uses Realtime for signed-in athletes without a claim token', () => {
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: true, hasClaimToken: false })).toBe(
      true
    );
  });

  it('uses Realtime for signed-in athletes even with a claim token', () => {
    expect(shouldUseMissionRealtimeTables({ isAuthenticated: true, hasClaimToken: true })).toBe(
      true
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
