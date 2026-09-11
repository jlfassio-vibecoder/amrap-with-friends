import type { CoachActivationFunnel } from '@/lib/api/coach';

interface CoachActivationFunnelCardProps {
  funnel: CoachActivationFunnel;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export function CoachActivationFunnelCard({ funnel }: CoachActivationFunnelCardProps) {
  const steps: Array<{ label: string; value: number }> = [
    { label: 'Signed up', value: funnel.signedUp },
    { label: 'Identity done', value: funnel.identityComplete },
    { label: 'Plan viewed', value: funnel.createViewed },
    { label: 'Mission created', value: funnel.missionCreated },
    { label: 'Started', value: funnel.missionStarted },
    { label: 'Finished', value: funnel.finished },
    { label: 'Claimed', value: funnel.claimed },
  ];

  const rates: Array<{ label: string; value: number | null }> = [
    { label: 'Signed up → identity', value: funnel.identityRatePct },
    { label: 'Identity → Plan viewed', value: funnel.createViewedRatePct },
    { label: 'Plan viewed → created', value: funnel.missionCreatedRatePct },
    { label: 'Created → started', value: funnel.missionStartedRatePct },
    { label: 'Started → finished', value: funnel.finishedRatePct },
    { label: 'Finished → claimed', value: funnel.claimedRatePct },
  ];

  return (
    <div className="card space-y-3 p-4 sm:col-span-2 lg:col-span-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        Activation (new sign-ups)
      </h3>
      <div className="flex flex-wrap gap-4">
        {steps.map((step) => (
          <div key={step.label}>
            <p className="text-xl font-bold tabular-nums text-ink">{step.value.toLocaleString()}</p>
            <p className="text-xs text-secondary">{step.label}</p>
          </div>
        ))}
      </div>
      <ul className="grid gap-1 text-sm text-secondary sm:grid-cols-2 lg:grid-cols-3">
        {rates.map((rate) => (
          <li key={rate.label}>
            {rate.label}: <span className="font-semibold text-ink">{pct(rate.value)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-secondary">
        Cohort is accounts created in this window. Later steps are unique users from that cohort.
        Plan viewed falls back to hosting a mission when create_viewed events are missing.
      </p>
    </div>
  );
}
