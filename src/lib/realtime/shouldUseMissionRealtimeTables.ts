/**
 * Signed-in seats use membership postgres_changes even when a claim token is
 * still in sessionStorage. Guests (no auth.uid) keep get_mission_live_state
 * polling because anon cannot SELECT live tables.
 */
export function shouldUseMissionRealtimeTables(input: {
  isAuthenticated: boolean;
  hasClaimToken: boolean;
}): boolean {
  return input.isAuthenticated;
}
