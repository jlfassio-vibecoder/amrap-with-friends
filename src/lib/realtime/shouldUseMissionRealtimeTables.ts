/**
 * Use postgres_changes only when the athlete is signed in and has no claim
 * token for this mission (membership RLS can apply). Anyone with a claim
 * keeps get_mission_live_state polling — including signed-in guests whose
 * seat is still claim-backed (user_id may still be null).
 */
export function shouldUseMissionRealtimeTables(input: {
  isAuthenticated: boolean;
  hasClaimToken: boolean;
}): boolean {
  return input.isAuthenticated && !input.hasClaimToken;
}
