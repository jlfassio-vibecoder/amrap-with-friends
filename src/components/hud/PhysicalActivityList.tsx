import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface PhysicalActivityListProps {
  entries: PhysicalActivityEntry[];
  onDelete: (id: string) => void;
}

export function PhysicalActivityList({ entries, onDelete }: PhysicalActivityListProps) {
  if (entries.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-sm text-secondary">
          No outside activity logged yet. Entries here do not count toward weekly
          classification minutes — that stays locked-AMRAP-only.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        Recent activity
      </h3>
      <ul className="divide-y divide-divider">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold text-ink">
                {entry.activityLabel}{' '}
                <span className="font-normal text-secondary">
                  · {entry.durationMinutes}m · {INTENSITY_LABEL[entry.intensityTier] ?? entry.intensityTier}
                </span>
              </p>
              <p className="text-xs text-secondary">
                {formatDate(entry.occurredAt)}
                {entry.notes ? ` · ${entry.notes}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs uppercase tracking-wide text-error hover:underline"
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
