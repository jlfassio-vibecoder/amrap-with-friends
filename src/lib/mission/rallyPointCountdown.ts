export const RALLY_POINT_COUNTDOWN_MAX_SECONDS = 600;

/**
 * Client/server skew allowance when judging whether an ends_at could have
 * come from set_rally_point_countdown (which only permits ≤ max seconds ahead).
 */
export const RALLY_POINT_COUNTDOWN_CLOCK_SKEW_MS = 30_000;

/**
 * `set_rally_point_countdown` only writes `now() + [1, max]` seconds. A far-future
 * ends_at (e.g. accidentally equal to `scheduled_at`) is not a host-armed clock —
 * treat it as unset so Start countdown stays available until the host arms it.
 * Past ends_at (overtime after T-0) remains plausible.
 */
export function isPlausibleRallyPointCountdownEndsAt(
  endsAtIso: string | null | undefined,
  nowMs: number
): boolean {
  if (!endsAtIso) {
    return false;
  }
  const endsAtMs = Date.parse(endsAtIso);
  if (!Number.isFinite(endsAtMs)) {
    return false;
  }
  if (endsAtMs <= nowMs) {
    return true;
  }
  return (
    endsAtMs <=
    nowMs + RALLY_POINT_COUNTDOWN_MAX_SECONDS * 1000 + RALLY_POINT_COUNTDOWN_CLOCK_SKEW_MS
  );
}

/** Returns ends_at only when it could be a host-armed T-minus clock. */
export function effectiveRallyPointCountdownEndsAt(
  endsAtIso: string | null | undefined,
  nowMs: number
): string | null {
  if (!isPlausibleRallyPointCountdownEndsAt(endsAtIso, nowMs)) {
    return null;
  }
  return endsAtIso ?? null;
}

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
