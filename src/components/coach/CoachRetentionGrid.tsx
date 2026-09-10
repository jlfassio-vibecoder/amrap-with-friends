import {
  toRetentionGrid,
  weekOneReturnRate,
  type RetentionCell,
} from '@/lib/coach/engagementInsights';

/** Heat by retention, not by raw count: a 100%-of-two cohort must not outshout a 40%-of-fifty one. */
function cellTone(pct: number | null): string {
  if (pct === null) {
    return 'text-secondary';
  }
  if (pct >= 60) {
    return 'bg-accent text-on-accent font-semibold';
  }
  if (pct >= 30) {
    return 'bg-accent/40 text-ink';
  }
  if (pct > 0) {
    return 'bg-accent/15 text-ink';
  }
  return 'text-secondary';
}

export function CoachRetentionGrid({ cells }: { cells: RetentionCell[] }) {
  const rows = toRetentionGrid(cells);
  const weekOne = weekOneReturnRate(cells);
  const maxOffset = cells.reduce((max, cell) => Math.max(max, cell.weekOffset), 0);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, index) => index);

  if (rows.length === 0) {
    return <p className="text-sm text-secondary">No cohorts have trained yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-secondary">
        Week 1 return rate:{' '}
        <span className="font-semibold text-ink">{weekOne === null ? '—' : `${weekOne}%`}</span> —
        of everyone who ran a first mission, the share who trained again the following week.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-secondary">
              <th className="py-1 pr-3 font-semibold">Cohort week</th>
              <th className="py-1 pr-3 text-right font-semibold">Athletes</th>
              {offsets.map((offset) => (
                <th key={offset} className="py-1 pr-3 text-right font-semibold">
                  W{offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohortWeek} className="border-t border-border">
                <td className="py-1 pr-3 tabular-nums text-ink">{row.cohortWeek}</td>
                <td className="py-1 pr-3 text-right tabular-nums text-secondary">
                  {row.cohortSize}
                </td>
                {offsets.map((offset) => {
                  const cell = row.cells.find((item) => item.weekOffset === offset);
                  return (
                    <td key={offset} className="py-1 pr-1">
                      {/* No cell means that week has not happened for this cohort — blank, not 0%. */}
                      <span
                        className={`block rounded px-1 text-right tabular-nums ${cellTone(
                          cell?.retainedPct ?? null
                        )}`}
                      >
                        {cell ? `${cell.retainedPct ?? 0}%` : ''}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
