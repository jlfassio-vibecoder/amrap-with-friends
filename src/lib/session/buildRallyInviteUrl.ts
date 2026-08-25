export function buildRallyInviteUrl(sessionId: string, origin: string): string {
  return `${origin}/join?s=${sessionId}`;
}
