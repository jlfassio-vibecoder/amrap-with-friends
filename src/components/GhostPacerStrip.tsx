interface GhostPacerStripProps {
  ghostLabel: string;
  ghostReps: number;
  selfReps: number;
  deltaReps: number;
  isLoading?: boolean;
}

function formatDelta(deltaReps: number): { text: string; className: string } {
  if (deltaReps > 0) {
    return {
      text: `+${deltaReps} Reps Ahead`,
      className: 'text-accent',
    };
  }

  if (deltaReps < 0) {
    return {
      text: `${deltaReps} Reps Behind`,
      className: 'text-error',
    };
  }

  return {
    text: 'Even',
    className: 'text-secondary',
  };
}

export function GhostPacerStrip({
  ghostLabel,
  ghostReps,
  selfReps,
  deltaReps,
  isLoading = false,
}: GhostPacerStripProps) {
  const delta = formatDelta(deltaReps);

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-sm lg:static lg:rounded-card lg:border lg:shadow-card"
      aria-live="polite"
      aria-label="Ghost pacer comparison"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2 lg:max-w-none">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          {ghostLabel}
        </p>

        <div className="grid grid-cols-3 gap-3 text-center tabular-nums">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Ghost</p>
            <p className="text-display text-xl text-ink">
              {isLoading ? '—' : ghostReps}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">You</p>
            <p className="text-display text-xl text-ink">{selfReps}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Delta</p>
            <p className={`text-display text-sm font-bold ${delta.className}`}>
              {isLoading ? '—' : delta.text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
