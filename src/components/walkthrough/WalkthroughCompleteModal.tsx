interface WalkthroughCompleteModalProps {
  onContinue: () => void;
  onNeverShowAgain: () => void;
}

export function WalkthroughCompleteModal({
  onContinue,
  onNeverShowAgain,
}: WalkthroughCompleteModalProps) {
  const titleId = 'walkthrough-complete-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="walkthrough-complete-modal"
    >
      <div
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-display text-xl text-ink">
          Let&apos;s do this!
        </h2>
        <p className="text-sm leading-relaxed text-secondary">
          You know the staging area. When you are ready, start the session or
          wait for the host.
        </p>
        <div className="space-y-2">
          <button type="button" className="btn-primary w-full" onClick={onContinue}>
            Let&apos;s do this!
          </button>
          <button
            type="button"
            className="btn-outline w-full"
            onClick={onNeverShowAgain}
          >
            Never show this again
          </button>
        </div>
      </div>
    </div>
  );
}
