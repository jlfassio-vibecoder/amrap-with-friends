/**
 * Personal squad invite URL. The code is the secret, same pattern as a
 * campaign invite — not a rally link (those stay session/campaign share URLs).
 */
export function buildSquadInviteUrl(inviteCode: string, origin: string): string {
  return `${origin}/squad/join?c=${encodeURIComponent(inviteCode)}`;
}
