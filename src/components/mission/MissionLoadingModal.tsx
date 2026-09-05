import { useId } from 'react';

interface MissionLoadingModalProps {
  onConfirm: () => void;
}

export function MissionLoadingModal({ onConfirm }: MissionLoadingModalProps) {
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="mission-loading-modal"
    >
      <div
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-display text-xl text-ink">
          Next mission loading
        </h2>
        <p className="text-sm leading-relaxed text-secondary">
          Hang tight — another mission is on the way. Stay with your squad, hydrate, and do a light
          dynamic warm-up until it starts.
        </p>
        <button type="button" className="btn-primary w-full" onClick={onConfirm}>
          Got it
        </button>
      </div>
    </div>
  );
}
