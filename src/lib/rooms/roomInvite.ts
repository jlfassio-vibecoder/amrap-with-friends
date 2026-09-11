/**
 * A room's shareable address.
 *
 * The invite *is* the room URL -- there is no separate token link in v1,
 * because a room is public and joining is an opt-in at the finish rather than
 * something a link grants. Keeping this in one place means the dashboard, the
 * share card and any future copy button cannot disagree about what to paste.
 */
export function roomInviteUrl(origin: string, handle: string): string {
  return `${origin}/@${handle.toLowerCase()}`;
}

/** What the host sees on the button, which is shorter than the URL it copies. */
export function roomInviteLabel(handle: string): string {
  return `@${handle.toLowerCase()}`;
}

export interface RoomActivityCounts {
  finishedThisWeek: number;
  athletesThisWeek: number;
  missionsThisWeek: number;
  returningAthletes: number;
}

/**
 * The sentence a host actually wants: how many finished, and how many came
 * back. "Came back" is the pilot's primary metric from the host's side.
 */
export function roomActivitySentence(counts: RoomActivityCounts): string {
  if (counts.missionsThisWeek === 0) {
    return 'No missions this week yet.';
  }
  if (counts.finishedThisWeek === 0) {
    return 'No finishes yet this week.';
  }

  const finishes = `${counts.finishedThisWeek} ${counts.finishedThisWeek === 1 ? 'finish' : 'finishes'}`;
  const athletes = `${counts.athletesThisWeek} ${counts.athletesThisWeek === 1 ? 'athlete' : 'athletes'}`;
  const base = `${finishes} this week from ${athletes}.`;

  // Silence about returners would read as zero. Say it either way.
  return counts.returningAthletes > 0
    ? `${base} ${counts.returningAthletes} ${counts.returningAthletes === 1 ? 'has' : 'have'} trained with you more than once.`
    : `${base} Nobody has come back for a second one yet.`;
}
