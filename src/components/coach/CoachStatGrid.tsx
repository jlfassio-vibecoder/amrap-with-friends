export interface CoachStat {
  label: string;
  value: number;
  id?: string;
  selectable?: boolean;
}

interface CoachStatGridProps {
  stats: CoachStat[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function CoachStatGrid({ stats, selectedId = null, onSelect }: CoachStatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => {
        const selected = Boolean(stat.id && selectedId === stat.id);
        const className = selected
          ? 'card space-y-1 border-accent p-4 text-left'
          : 'card space-y-1 p-4 text-left';

        const body = (
          <>
            <p className="text-2xl font-bold tabular-nums text-ink">
              {stat.value.toLocaleString()}
            </p>
            <p className="text-xs uppercase tracking-wide text-secondary">{stat.label}</p>
          </>
        );

        if (stat.selectable && stat.id && onSelect) {
          return (
            <button
              key={stat.id}
              type="button"
              className={className}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : stat.id!)}
            >
              {body}
            </button>
          );
        }

        return (
          <div key={stat.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
