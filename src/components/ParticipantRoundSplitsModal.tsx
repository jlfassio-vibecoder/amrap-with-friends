import {
  formatSplitDuration,
  type ParticipantSplitEntry,
} from '@/lib/sessionSync/computeParticipantSplits';

interface ParticipantRoundSplitsModalProps {
  nickname: string;
  splits: ParticipantSplitEntry[];
  onClose: () => void;
}

export function ParticipantRoundSplitsModal({
  nickname,
  splits,
  onClose,
}: ParticipantRoundSplitsModalProps) {
  const titleId = 'participant-round-splits-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-xl text-ink">
            {nickname}
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {splits.length === 0 ? (
          <p className="text-sm text-secondary">No rounds logged yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {splits.map((split) => (
              <div
                key={split.roundNumber}
                className="flex flex-col items-center rounded-card border border-border bg-page px-2 py-2 text-center tabular-nums"
              >
                <span className="text-xs font-medium text-muted">
                  Round {split.roundNumber}
                </span>
                <span className="text-display text-lg text-accent">
                  {formatSplitDuration(split.durationSec)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
