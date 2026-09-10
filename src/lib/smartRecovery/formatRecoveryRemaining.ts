import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';
import { movementPatternLabel } from '@/lib/smartRecovery/movementPatterns';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function formatRecoveryRemaining(expiresAt: Date, now: Date): string {
  const remainingMs = expiresAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return '0h remaining';
  }

  if (remainingMs >= MS_PER_DAY) {
    const days = Math.ceil(remainingMs / MS_PER_DAY);
    return `${days}d remaining`;
  }

  const hours = Math.max(1, Math.ceil(remainingMs / MS_PER_HOUR));
  return `${hours}h remaining`;
}

export function formatRecoveryLockMessage(lock: TemplateRecoveryLock, now: Date): string {
  const remaining = formatRecoveryRemaining(lock.expiresAt, now);

  switch (lock.reason) {
    case 'exact-match':
      return `Recovery lock: same workout — ${remaining}`;
    case 'severe-intensity':
      return `Recovery lock: CNS recovery — ${remaining}`;
    case 'movement-pattern':
      return `Recovery lock: ${movementPatternLabel(lock.pattern ?? 'full-body-conditioning')} — ${remaining}`;
  }
}
