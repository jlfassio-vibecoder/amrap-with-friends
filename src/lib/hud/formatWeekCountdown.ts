function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Format remaining time until weekEndsAt as `Xd HH:MM:SS` or `HH:MM:SS`. */
export function formatWeekCountdown(
  weekEndsAt: string | Date,
  nowMs: number = Date.now()
): string {
  const endMs =
    typeof weekEndsAt === 'string'
      ? new Date(weekEndsAt).getTime()
      : weekEndsAt.getTime();

  if (!Number.isFinite(endMs)) {
    return '00:00:00';
  }

  const remainingMs = Math.max(0, endMs - nowMs);
  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  if (days > 0) {
    return `${days}d ${clock}`;
  }

  return clock;
}
