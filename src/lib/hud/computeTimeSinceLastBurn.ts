import type { HudDailyStatus } from '@/lib/hud/types';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Hours since the last locked mission at which each status begins. */
export const DORMANT_AFTER_HOURS = 24;
export const DETRAINING_AFTER_HOURS = 48;

export interface TimeSinceLastBurn {
  status: HudDailyStatus;
  /** The clock itself, e.g. "55:41". Counts up. */
  label: string;
  /** What the clock is measuring, for the caption under it. */
  caption: string;
  hoursElapsed: number | null;
}

export function computeTimeSinceLastBurn(
  lastLockedAt: string | null,
  nowMs: number
): TimeSinceLastBurn {
  const noRecord: TimeSinceLastBurn = {
    status: 'never',
    label: '—',
    caption: 'No locked mission on record yet.',
    hoursElapsed: null,
  };

  if (lastLockedAt === null) {
    return noRecord;
  }

  const lockedMs = new Date(lastLockedAt).getTime();
  if (!Number.isFinite(lockedMs)) {
    return noRecord;
  }

  const elapsedMs = Math.max(0, nowMs - lockedMs);
  const totalMinutes = Math.floor(elapsedMs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  // This clock counts *up* from the last locked mission. It used to be labelled
  // "T-MINUS", which names a countdown to something — so a reader waited for it
  // to fall, decided it was frozen, and never learned what it measured.
  const label = `${pad2(hours)}:${pad2(minutes)}`;
  const caption = 'since your last locked mission';

  const hoursElapsed = elapsedMs / HOUR_MS;

  if (hoursElapsed < DORMANT_AFTER_HOURS) {
    return { status: 'active', label, caption, hoursElapsed };
  }

  if (hoursElapsed < DETRAINING_AFTER_HOURS) {
    return { status: 'dormant', label, caption, hoursElapsed };
  }

  return { status: 'detraining', label, caption, hoursElapsed };
}
