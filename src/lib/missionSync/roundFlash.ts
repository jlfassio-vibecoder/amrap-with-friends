/**
 * Which athletes just landed a round.
 *
 * The board is the only place a room sees anyone else move, and a number
 * changing by one is easy to miss on a phone at the end of a hard round. The
 * creators mock flashes the bar; this works out who to flash.
 *
 * Pure, and takes the previous counts as an argument rather than holding them,
 * so the rule can be asserted without a component: an athlete flashes when
 * their count went *up*, never when they appear for the first time -- everyone
 * joining mid-mission would otherwise flash at once -- and never when it goes
 * down, which is a resync correcting an over-count rather than work being done.
 */
export function participantsWhoAdvanced(
  previous: Record<string, number>,
  next: Record<string, number>
): string[] {
  return Object.keys(next).filter((id) => {
    const before = previous[id];
    return before !== undefined && next[id]! > before;
  });
}

export function roundCountsById(
  entries: { participantId: string; roundCount: number }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.participantId] = entry.roundCount;
  }
  return counts;
}
