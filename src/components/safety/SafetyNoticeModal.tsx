import { useId } from 'react';

interface SafetyNoticeModalProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function SafetyNoticeModal({
  title,
  body,
  confirmLabel = 'I understand',
  onConfirm,
}: SafetyNoticeModalProps) {
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="safety-notice-modal"
    >
      <div
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-display text-xl text-ink">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-secondary">{body}</p>
        <button type="button" className="btn-primary w-full" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
