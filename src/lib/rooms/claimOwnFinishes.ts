import type { RoomFeedRow } from '@/lib/rooms/roomFeed';

/**
 * The finishes on this page that this device can prove are its own, and that
 * are still showing unnamed.
 *
 * The feed's account prompt says an account carries your name onto results
 * already on the page. That is only true if signing up actually attaches the
 * guest participant to the new account — joining the room does not do it, and
 * without this the prompt promised something the product did not do, then
 * disappeared as though it had.
 *
 * A row qualifies only when this browser holds both halves: the participant id
 * it recorded for that mission, and the claim token that proves it. Anything
 * else is somebody else's result.
 */
export function ownUnclaimedFinishes(
  rows: RoomFeedRow[],
  participantFor: (missionId: string) => string | null,
  tokenFor: (missionId: string) => string | null
): { participantId: string; claimToken: string }[] {
  const seen = new Set<string>();
  const out: { participantId: string; claimToken: string }[] = [];

  for (const row of rows) {
    if (row.nickname !== null) {
      continue;
    }
    if (participantFor(row.missionId) !== row.participantId) {
      continue;
    }
    const claimToken = tokenFor(row.missionId);
    // One claim per participant: a mission with several segments shows several
    // rows, and claiming attaches the participant, not the result.
    if (!claimToken || seen.has(row.participantId)) {
      continue;
    }
    seen.add(row.participantId);
    out.push({ participantId: row.participantId, claimToken });
  }

  return out;
}
