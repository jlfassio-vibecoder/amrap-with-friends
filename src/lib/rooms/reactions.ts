/**
 * The fixed set of reactions a host can leave on a finish.
 *
 * Fixed, because the plan gives v1 an announcement and reactions and no chat:
 * the point is that a coach can say "I saw that" in one tap, not that a room
 * grows a comment thread. Free text would be a different product decision with
 * moderation attached, and there is no moderation tooling.
 *
 * The database holds the same four in a CHECK constraint. `reactions.test.ts`
 * reads the migration and fails if the two ever drift, because a label added
 * here alone would be refused at the door with no clue why.
 */

export const ROOM_REACTIONS = ['respect', 'fire', 'grit', 'salute'] as const;

export type RoomReaction = (typeof ROOM_REACTIONS)[number];

export function isRoomReaction(value: string): value is RoomReaction {
  return (ROOM_REACTIONS as readonly string[]).includes(value);
}

/** What the host taps. Words rather than emoji: the brand has a voice. */
export const REACTION_LABELS: Record<RoomReaction, string> = {
  respect: 'Respect',
  fire: 'On fire',
  grit: 'Grit',
  salute: 'Salute',
};

/**
 * Tapping the reaction you already left takes it back.
 *
 * One reaction per person per finish, so choosing a different one replaces
 * rather than adds. Returns what to send: null clears it.
 */
export function nextReaction(
  current: RoomReaction | null,
  tapped: RoomReaction
): RoomReaction | null {
  return current === tapped ? null : tapped;
}

/** How a finish reads in the host's list. */
export function finishLine(nickname: string, score: number | null, isGuest: boolean): string {
  const who = nickname.trim().length > 0 ? nickname.trim() : 'Athlete';
  const guest = isGuest ? ' · guest' : '';
  return score === null ? `${who}${guest}` : `${who} — ${score} reps${guest}`;
}
