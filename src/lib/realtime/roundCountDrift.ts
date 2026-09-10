/**
 * Does this client's view of the rounds disagree with the server's?
 *
 * The reconcile exists because a dropped INSERT leaves a hole nothing else
 * closes, but pulling the whole mission every thirty seconds to look for one
 * is what makes the traffic grow with the square of the roster. Asking for a
 * count per participant costs a fraction of that, and the full snapshot is
 * only worth its bytes once the answer is yes.
 *
 * Local *below* remote is the hole this was built for. Local *above* remote is
 * worth resyncing too: it means this client is holding a round the server does
 * not have -- an optimistic row that never landed, or a mission that was reset
 * underneath it -- and the board is over-counting until something corrects it.
 */
export interface RemoteRoundCount {
  participantId: string;
  roundCount: number;
}

export function hasRoundCountDrift(
  local: Record<string, number>,
  remote: RemoteRoundCount[]
): boolean {
  for (const entry of remote) {
    if ((local[entry.participantId] ?? 0) !== entry.roundCount) {
      return true;
    }
  }

  // A participant this client knows about who is absent from the server's
  // answer is drift as well -- every seat in the mission is listed, including
  // the ones with no rounds, so an id missing here is one we invented.
  const known = new Set(remote.map((entry) => entry.participantId));
  for (const [participantId, count] of Object.entries(local)) {
    if (count > 0 && !known.has(participantId)) {
      return true;
    }
  }

  return false;
}
