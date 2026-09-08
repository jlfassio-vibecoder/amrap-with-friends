import { formatWeekRangeLabel } from '@/lib/hud/weekHistory';
import type { HudHistoryWeek } from '@/lib/hud/types';

interface AttritionGridProps {
  attrition: boolean[];
  weekEndsAt: string;
  /** Per-week detail. Empty against a server that predates the week-history migration. */
  weeks?: HudHistoryWeek[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
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
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function weekStartForIndex(weekEndsAt: string, index: number): Date {
  const currentStart = currentWeekStartDate(weekEndsAt);
  const offsetWeeks = 11 - index;
  return new Date(currentStart.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

const CELL_BASE = 'inline-block h-4 w-4 shrink-0';

function cellFill(compliant: boolean): string {
  return compliant ? 'bg-accent' : 'border border-border bg-transparent';
}

/**
 * Twelve weeks of compliance, and — once the server sends per-week detail —
 * the HUD's way into any one of them.
 *
 * The strip was already a row of weeks, so it becomes the navigator rather
 * than the page growing a separate stepper: the affordance is the data.
 * Without `weeks` (a server behind the migration) it renders exactly as it
 * always did, inert.
 */
export function AttritionGrid({
  attrition,
  weekEndsAt,
  weeks = [],
  selectedIndex = null,
  onSelect,
}: AttritionGridProps) {
  const cells = attrition.slice(0, 12);

  while (cells.length < 12) {
    cells.push(false);
  }

  const selectable = onSelect !== undefined && weeks.length === cells.length;

  return (
    <section className="card space-y-3 p-4" aria-label="12-week attrition">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">12-week attrition</p>
      <div className="flex items-center justify-between gap-1">
        {cells.map((compliant, index) => {
          const week = weeks[index];
          const label = week
            ? `Week of ${formatWeekRangeLabel(week.weekStart)}: ${
                compliant ? 'compliant' : 'deficient'
              }, ${week.missionCount === 1 ? '1 mission' : `${week.missionCount} missions`}`
            : `Week of ${formatWeekOf(weekStartForIndex(weekEndsAt, index))}: ${
                compliant ? 'compliant' : 'deficient'
              }`;

          if (!selectable) {
            return (
              <span
                key={`week-${index}`}
                className={`${CELL_BASE} ${cellFill(compliant)}`}
                aria-label={label}
              />
            );
          }

          return (
            <button
              key={`week-${index}`}
              type="button"
              // The ring sits outside the cell so a selected week reads as
              // picked without changing the compliant/deficient fill that the
              // strip is actually reporting.
              className={`${CELL_BASE} ${cellFill(compliant)} hover:ring-2 hover:ring-secondary ${
                selectedIndex === index ? 'ring-2 ring-ink ring-offset-1' : ''
              }`}
              aria-label={label}
              aria-pressed={selectedIndex === index}
              onClick={() => onSelect(index)}
            />
          );
        })}
      </div>
      {selectable ? (
        <p className="text-xs text-secondary">Select a week to see what it was made of.</p>
      ) : null}
    </section>
  );
}
