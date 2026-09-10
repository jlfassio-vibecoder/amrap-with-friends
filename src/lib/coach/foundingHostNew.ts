const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** True when any event occurred within the last 7 days of `nowMs`. */
export function hasFoundingHostApplicationInLast7Days(
  events: readonly { occurredAt: string }[],
  nowMs: number
): boolean {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  return events.some((event) => {
    const occurredMs = Date.parse(event.occurredAt);
    return Number.isFinite(occurredMs) && occurredMs >= cutoff;
  });
}
