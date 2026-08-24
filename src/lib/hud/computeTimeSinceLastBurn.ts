import type { HudDailyStatus } from '@/lib/hud/types';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function computeTimeSinceLastBurn(
  lastLockedAt: string | null,
  nowMs: number
): { status: HudDailyStatus; label: string } {
  if (lastLockedAt === null) {
    return { status: 'never', label: 'NO LOCK ON RECORD' };
  }

  const lockedMs = new Date(lastLockedAt).getTime();
  if (!Number.isFinite(lockedMs)) {
    return { status: 'never', label: 'NO LOCK ON RECORD' };
  }

  const elapsedMs = Math.max(0, nowMs - lockedMs);
  const totalMinutes = Math.floor(elapsedMs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label = `T-MINUS ${pad2(hours)}:${pad2(minutes)}`;

  if (elapsedMs < 24 * HOUR_MS) {
    return { status: 'active', label };
  }

  if (elapsedMs < 48 * HOUR_MS) {
    return { status: 'dormant', label };
  }

  return { status: 'detraining', label };
}
