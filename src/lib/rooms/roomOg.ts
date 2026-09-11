/**
 * What a room link says about itself when it unfurls.
 *
 * No `@/` alias and no imports, for the same reason as shareOg.ts: the edge
 * runtime does not resolve the alias.
 *
 * A room link is shared the way a share card is -- pasted into a group chat,
 * posted to a story -- so it gets the same treatment the share page already
 * settled: everyone receives the real tags, because a user-agent allowlist for
 * "things that unfurl links" cannot be completed, and Apple's Messages fetches
 * with an ordinary Safari user agent.
 */

export interface RoomSummary {
  handle: string;
  displayName: string;
  intro: string | null;
  memberCount: number;
  avatarPath: string | null;
}

export function roomOgTitle(room: RoomSummary | null): string {
  if (!room) {
    return 'Train with your coach on AMRAP With Friends';
  }
  return `${room.displayName} · @${room.handle}`;
}

export function roomOgDescription(room: RoomSummary | null): string {
  if (!room) {
    return 'Join a live AMRAP mission. One synced clock, one shared leaderboard, no app to install.';
  }
  if (room.intro && room.intro.trim().length > 0) {
    return room.intro.trim().slice(0, 200);
  }
  // The member count is the only honest thing we can say about a room with no
  // intro, and "1 member" reads worse than saying nothing about size at all.
  return room.memberCount > 1
    ? `Train with ${room.displayName} and ${room.memberCount - 1} others. One synced clock, no app to install.`
    : `Train with ${room.displayName}. One synced clock, no app to install.`;
}

/**
 * A room's avatar if it has one, otherwise the site card. Rooms have no
 * generated image of their own yet -- that arrives with room-branded share
 * cards -- so this must never point at a path that 404s.
 */
export function roomOgImage(
  room: RoomSummary | null,
  origin: string,
  supabaseUrl: string | null
): string {
  if (room?.avatarPath && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/room-media/${room.avatarPath}`;
  }
  return `${origin}/og-image-f.png`;
}

/** `/@handle`, normalized. The canonical never carries the case someone typed. */
export function roomCanonical(origin: string, handle: string): string {
  return `${origin}/@${handle.toLowerCase()}`;
}
