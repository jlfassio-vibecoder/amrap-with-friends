import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';
import { formatRecoveryLockMessage } from '@/lib/smartRecovery/formatRecoveryRemaining';

interface RecoveryLockMessageProps {
  lock: TemplateRecoveryLock;
}

export function RecoveryLockMessage({ lock }: RecoveryLockMessageProps) {
  return (
    <p
      className="flex items-center gap-1.5 text-xs text-secondary"
      data-testid="recovery-lock-message"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4 shrink-0"
        aria-hidden
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {formatRecoveryLockMessage(lock, new Date())}
    </p>
  );
}
