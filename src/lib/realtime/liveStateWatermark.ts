export function nextLiveStateSince(input: {
  previous: string | null;
  rounds: { created_at: string }[];
  messages: { created_at: string }[];
  segmentResults: { updated_at: string }[];
}): string | null {
  let latestMs = input.previous ? Date.parse(input.previous) : Number.NaN;
  if (!Number.isFinite(latestMs)) {
    latestMs = 0;
  }

  for (const stamp of [
    ...input.rounds.map((row) => row.created_at),
    ...input.messages.map((row) => row.created_at),
    ...input.segmentResults.map((row) => row.updated_at),
  ]) {
    const ms = Date.parse(stamp);
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
    }
  }

  return latestMs > 0 ? new Date(latestMs).toISOString() : input.previous;
}
