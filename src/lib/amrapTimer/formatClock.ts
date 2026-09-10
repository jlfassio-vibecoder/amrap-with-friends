/**
 * Seconds as the clock a gym display shows: `MM:SS`, and `H:MM:SS` only once an
 * hour is actually on the board. Negative input clamps to zero — a countdown
 * that overshoots by a tick should read 00:00, not -00:01.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
