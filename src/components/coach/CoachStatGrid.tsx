interface CoachStat {
  label: string;
  value: number;
}

export function CoachStatGrid({ stats }: { stats: CoachStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card space-y-1 p-4">
          <p className="text-2xl font-bold tabular-nums text-ink">
            {stat.value.toLocaleString()}
          </p>
          <p className="text-xs uppercase tracking-wide text-secondary">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
