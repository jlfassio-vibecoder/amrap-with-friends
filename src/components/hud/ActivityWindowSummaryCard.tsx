interface ActivityWindowSummaryCardProps {
  title: string;
  ariaLabel: string;
  missionCount: number;
  totalMinutes: number;
  averageIntensity: number | null;
  footer: string;
}

export function ActivityWindowSummaryCard({
  title,
  ariaLabel,
  missionCount,
  totalMinutes,
  averageIntensity,
  footer,
}: ActivityWindowSummaryCardProps) {
  return (
    <section className="card space-y-3 p-4" aria-label={ariaLabel}>
      <p className="text-xs font-medium uppercase tracking-wide text-secondary">{title}</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Missions</dt>
          <dd className="text-lg tabular-nums text-ink">{missionCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Minutes</dt>
          <dd className="text-lg tabular-nums text-ink">{totalMinutes}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Avg intensity</dt>
          <dd className="text-lg tabular-nums text-ink">
            {averageIntensity !== null ? averageIntensity.toFixed(1) : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-secondary">{footer}</p>
    </section>
  );
}
