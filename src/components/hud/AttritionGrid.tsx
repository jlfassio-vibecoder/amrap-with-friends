import { formatWeekRangeLabel } from '@/lib/hud/weekHistory';
import type { HudHistoryWeek } from '@/lib/hud/types';

interface AttritionGridProps {
  attrition: boolean[];
  weekEndsAt: string;
  /** Per-week detail. Empty against a server that predates the week-history migration. */
  weeks?: HudHistoryWeek[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  /** When true, omit the outer card chrome (parent owns the card). */
  embedded?: boolean;
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

/** `dataIndex` 0 is oldest, 11 is current — same order as `attrition` / `weeks`. */
function weekStartForDataIndex(weekEndsAt: string, dataIndex: number): Date {
  const currentStart = currentWeekStartDate(weekEndsAt);
  const offsetWeeks = 11 - dataIndex;
  return new Date(currentStart.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

const CELL_BASE = 'inline-block h-4 w-4 shrink-0';

/**
 * Empty weeks stay outlined. Weeks with locked missions use the same accent /
 * muted pair as WeekDetailPanel so the strip still reads compliant vs deficient.
 */
function cellFill(hasActivity: boolean, compliant: boolean): string {
  if (!hasActivity) {
    return 'border border-border bg-transparent';
  }
  return compliant ? 'bg-accent' : 'bg-muted';
}

/**
 * Twelve weeks of history, and — once the server sends per-week detail —
 * the HUD's way into any one of them.
 *
 * Drawn newest-first so the current week is the first cell an athlete reads.
 * Selection still uses the data index (`weeks[0]` oldest … `weeks[11]` current)
 * so the detail panel and steppers stay aligned with the RPC.
 *
 * Without `weeks` (a server behind the migration) it renders inert, still
 * newest-first, with the old compliant fill.
 */
export function AttritionGrid({
  attrition,
  weekEndsAt,
  weeks = [],
  selectedIndex = null,
  onSelect,
  embedded = false,
}: AttritionGridProps) {
  const cells = attrition.slice(0, 12);

  while (cells.length < 12) {
    cells.push(false);
  }

  const selectable = onSelect !== undefined && weeks.length === cells.length;
  // Newest on the left: walk data indexes from current → oldest.
  const displayOrder = cells.map((_, dataIndex) => dataIndex).reverse();

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">12-week attrition</p>
      <div className="flex items-center justify-between gap-1">
        {displayOrder.map((dataIndex) => {
          const compliant = cells[dataIndex]!;
          const week = weeks[dataIndex];
          const hasActivity = week ? week.missionCount > 0 : compliant;
          const label = week
            ? `Week of ${formatWeekRangeLabel(week.weekStart)}: ${
                compliant ? 'compliant' : 'deficient'
              }, ${week.missionCount === 1 ? '1 mission' : `${week.missionCount} missions`}`
            : `Week of ${formatWeekOf(weekStartForDataIndex(weekEndsAt, dataIndex))}: ${
                compliant ? 'compliant' : 'deficient'
              }`;

          if (!selectable) {
            return (
              <span
                key={`week-${dataIndex}`}
                className={`${CELL_BASE} ${cellFill(hasActivity, compliant)}`}
                aria-label={label}
              />
            );
          }

          return (
            <button
              key={`week-${dataIndex}`}
              type="button"
              // The ring sits outside the cell so a selected week reads as
              // picked without changing the activity fill the strip reports.
              className={`${CELL_BASE} ${cellFill(hasActivity, compliant)} hover:ring-2 hover:ring-secondary ${
                selectedIndex === dataIndex ? 'ring-2 ring-ink ring-offset-1' : ''
              }`}
              aria-label={label}
              aria-pressed={selectedIndex === dataIndex}
              onClick={() => onSelect(dataIndex)}
            />
          );
        })}
      </div>
      {selectable ? <p className="text-xs text-secondary">Tap a week to inspect it.</p> : null}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3" aria-label="12-week attrition">
        {body}
      </div>
    );
  }

  return (
    <section className="card space-y-3 p-4" aria-label="12-week attrition">
      {body}
    </section>
  );
}
