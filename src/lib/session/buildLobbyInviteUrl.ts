export function buildLobbyInviteUrl(lobbyId: string, origin: string): string {
  return `${origin}/join?l=${lobbyId}`;
}
