/**
 * Which coach an athlete's purchases are attributed to.
 *
 * Set once. An athlete who already has a home coach keeps them when they join
 * another room -- and is told so, rather than being silently reassigned,
 * because the alternative is a commission quietly moving between two people who
 * both think they earned it.
 *
 * Membership, attribution and the saved result stay three separate records even
 * though the post-finish sheet shows the athlete one checkbox. This is only the
 * attribution half.
 */

export interface HomeCoachInput {
  /** The athlete's existing home coach, or null when they have none. */
  current: string | null;
  /** The user id of the coach who owns the room being joined. */
  joining: string;
  /** The athlete themselves -- a host is never their own home coach. */
  self: string;
  /** Whether the athlete left the room checkbox ticked. */
  optedIn: boolean;
}

export type HomeCoachOutcome =
  /** Nothing to attribute: the athlete declined, or is the host. */
  | { action: 'none' }
  /** First coach. Write the attribution and open the ledger row. */
  | { action: 'set'; coachUserId: string }
  /** They already have one, and it stays. */
  | { action: 'kept'; coachUserId: string };

export function resolveHomeCoach(input: HomeCoachInput): HomeCoachOutcome {
  if (!input.optedIn) {
    return { action: 'none' };
  }
  if (input.joining === input.self) {
    return { action: 'none' };
  }
  if (input.current !== null) {
    return { action: 'kept', coachUserId: input.current };
  }
  return { action: 'set', coachUserId: input.joining };
}

/**
 * What the post-finish sheet says after the athlete taps save.
 *
 * The 'kept' case is the one that has to be said out loud: the athlete joined
 * the room and nothing about their attribution changed, and if we stay silent
 * they will reasonably assume it did.
 */
export function homeCoachNotice(
  outcome: HomeCoachOutcome,
  roomName: string,
  existingCoachName?: string
): string | null {
  switch (outcome.action) {
    case 'set':
      return `You're training with ${roomName}.`;
    case 'kept':
      return existingCoachName
        ? `You joined ${roomName}. ${existingCoachName} stays your home coach.`
        : `You joined ${roomName}. Your home coach is unchanged.`;
    case 'none':
      return null;
  }
}
