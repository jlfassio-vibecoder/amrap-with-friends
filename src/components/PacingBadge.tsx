interface PacingBadgeProps {
  classification: string;
  verdict: string;
}

function badgeStyles(classification: string): string {
  switch (classification) {
    case 'Elite Pacing':
      return 'border-accent/30 bg-accent-tint text-accent';
    case 'Power Leak':
    case 'System Failure':
      return 'border-accent/30 bg-accent-tint text-error';
    case 'Standard':
      return 'border-border bg-page text-muted';
    default:
      return 'border-border bg-page text-muted';
  }
}

function badgeLabel(classification: string): string {
  switch (classification) {
    case 'Elite Pacing':
      return 'Elite';
    case 'Power Leak':
      return 'Leak';
    case 'System Failure':
      return 'Fail';
    case 'Standard':
      return 'Std';
    default:
      return '—';
  }
}

export function PacingBadge({ classification, verdict }: PacingBadgeProps) {
  const label = badgeLabel(classification);
  const tooltip = verdict.trim() || classification;

  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeStyles(classification)}`}
      title={tooltip}
      aria-label={tooltip}
    >
      {label}
    </button>
  );
}
