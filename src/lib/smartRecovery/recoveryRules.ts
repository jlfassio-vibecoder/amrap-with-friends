export const EXACT_MATCH_LOCK_MS = 6 * 24 * 60 * 60 * 1000;
export const SEVERE_INTENSITY_LOCK_MS = 72 * 60 * 60 * 1000;
export const MOVEMENT_PATTERN_LOCK_MS = 48 * 60 * 60 * 1000;
export const SEVERE_INTENSITY_THRESHOLD = 4 as const;

export const RECOVERY_LOCK_REASON_PRECEDENCE = {
  'exact-match': 3,
  'severe-intensity': 2,
  'movement-pattern': 1,
} as const;

export function lockExpiresAt(completedAt: string | Date, lockMs: number): Date {
  const startMs =
    typeof completedAt === 'string' ? new Date(completedAt).getTime() : completedAt.getTime();
  return new Date(startMs + lockMs);
}
