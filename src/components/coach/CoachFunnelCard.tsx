interface CoachFunnelStep {
  label: string;
  value: number;
}

interface CoachFunnelCardProps {
  title: string;
  steps: CoachFunnelStep[];
  ratePct: number | null;
  rateLabel: string;
}

export function CoachFunnelCard({ title, steps, ratePct, rateLabel }: CoachFunnelCardProps) {
  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        {title}
      </h3>
      <div className="flex flex-wrap gap-4">
        {steps.map((step) => (
          <div key={step.label}>
            <p className="text-xl font-bold tabular-nums text-ink">
              {step.value.toLocaleString()}
            </p>
            <p className="text-xs text-secondary">{step.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-secondary">
        {rateLabel}:{' '}
        <span className="font-semibold text-ink">
          {ratePct === null ? '—' : `${ratePct}%`}
        </span>
      </p>
    </div>
  );
}
