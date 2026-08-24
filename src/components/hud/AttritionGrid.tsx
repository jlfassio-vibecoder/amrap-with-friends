interface AttritionGridProps {
  attrition: boolean[];
  weekEndsAt: string;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Current week Monday (local date string) from weekEndsAt (next Monday 00:00). */
function currentWeekStartDate(weekEndsAt: string): Date {
  const end = new Date(weekEndsAt);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return start;
}

function formatWeekOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function weekStartForIndex(weekEndsAt: string, index: number): Date {
  const currentStart = currentWeekStartDate(weekEndsAt);
  const offsetWeeks = 11 - index;
  return new Date(currentStart.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

export function AttritionGrid({ attrition, weekEndsAt }: AttritionGridProps) {
  const cells = attrition.slice(0, 12);

  while (cells.length < 12) {
    cells.push(false);
  }

  return (
    <section className="card space-y-3 p-4" aria-label="12-week attrition">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        12-week attrition
      </p>
      <div className="flex items-center justify-between gap-1">
        {cells.map((compliant, index) => {
          const weekOf = formatWeekOf(weekStartForIndex(weekEndsAt, index));
          return (
            <span
              key={`week-${index}`}
              className={
                compliant
                  ? 'inline-block h-4 w-4 shrink-0 bg-accent'
                  : 'inline-block h-4 w-4 shrink-0 border border-border bg-transparent'
              }
              aria-label={`Week of ${weekOf}: ${compliant ? 'compliant' : 'deficient'}`}
            />
          );
        })}
      </div>
    </section>
  );
}
