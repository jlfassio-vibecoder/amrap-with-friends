/** Minimum gap between Log round taps so a double-press cannot bank two rounds. */
export const LOG_ROUND_COOLDOWN_MS = 10_000;

export const LOG_ROUND_COOLDOWN_ALERT = 'Round logged, continue next round';

/** True when enough time has passed since the last accepted log. */
export function canLogRound(lastLoggedAtMs: number | null, nowMs: number): boolean {
  if (lastLoggedAtMs === null) {
    return true;
  }
  return nowMs - lastLoggedAtMs >= LOG_ROUND_COOLDOWN_MS;
}
