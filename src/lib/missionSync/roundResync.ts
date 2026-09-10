/**
 * Whether a successful round log means the client's own view is stale.
 *
 * A round index comes from the client's realtime view of its own rounds. The
 * server now heals a stale one rather than refusing it, so the round is written
 * either way — but if it was written at an index the client did not ask for,
 * the client is short an INSERT it never received, and nothing else will
 * correct the count on screen.
 *
 * That is the whole signal: the index came back different, so resync.
 */
export function shouldResyncAfterLog(sentIndex: number, writtenIndex: number): boolean {
  return sentIndex !== writtenIndex;
}
