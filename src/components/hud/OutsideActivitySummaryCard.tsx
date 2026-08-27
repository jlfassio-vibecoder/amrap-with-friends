import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';

interface OutsideActivitySummaryCardProps {
  entries: PhysicalActivityEntry[];
}

const WINDOW_DAYS = 7;

function isWithinWindow(occurredAt: string): boolean {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Date(occurredAt).getTime() >= cutoff;
}

export function OutsideActivitySummaryCard({ entries }: OutsideActivitySummaryCardProps) {
  const recent = entries.filter((entry) => isWithinWindow(entry.occurredAt));
  const totalMinutes = recent.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const averageIntensity =
    recent.length > 0
      ? recent.reduce((sum, entry) => sum + entry.intensityTier, 0) / recent.length
      : 0;

  return (
    <section className="card space-y-3 p-4" aria-label="Outside activity summary">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary">
        Outside Activity — Last 7 Days
      </p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Sessions</dt>
          <dd className="tabular-nums text-lg text-ink">{recent.length}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Minutes</dt>
          <dd className="tabular-nums text-lg text-ink">{totalMinutes}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-secondary">Avg intensity</dt>
          <dd className="tabular-nums text-lg text-ink">
            {recent.length > 0 ? averageIntensity.toFixed(1) : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-secondary">
        Does not count toward weekly classification minutes.
      </p>
    </section>
  );
}
