export const RALLY_POINT_COUNTDOWN_MAX_SECONDS = 600;

export function remainingRallyPointCountdownSec(
  endsAtIso: string | null | undefined,
  nowMs: number
): number | null {
  if (!endsAtIso) {
    return null;
  }
  const endsAtMs = Date.parse(endsAtIso);
  if (!Number.isFinite(endsAtMs)) {
    return null;
  }
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

/** Seconds since the rally point countdown ended (0 while still before ends_at). */
export function elapsedPastRallyPointCountdownSec(
  endsAtIso: string | null | undefined,
  nowMs: number
): number | null {
  if (!endsAtIso) {
    return null;
  }
  const endsAtMs = Date.parse(endsAtIso);
  if (!Number.isFinite(endsAtMs)) {
    return null;
  }
  return Math.max(0, Math.floor((nowMs - endsAtMs) / 1000));
}

export function formatTMinus(remainingSec: number): string {
  const clamped = Math.max(0, Math.floor(remainingSec));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `T-MINUS ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Elapsed past T-0 for the host Start control, e.g. +00:00. */
export function formatPlusElapsed(elapsedSec: number): string {
  const clamped = Math.max(0, Math.floor(elapsedSec));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
