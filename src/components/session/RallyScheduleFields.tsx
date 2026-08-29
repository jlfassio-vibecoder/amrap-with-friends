import type { ReactNode } from 'react';
import type { RallyDay } from '@/lib/session/rallySchedule';

function chipClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-on-accent'
    : 'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink';
}

interface RallyScheduleFieldsProps {
  rallyDay: RallyDay;
  rallyTime: string;
  disabled?: boolean;
  onRallyDayChange: (value: RallyDay) => void;
  onRallyTimeChange: (value: string) => void;
  /** Optional Start/Practice actions stacked above the Day field. */
  dayActions?: ReactNode;
}

export function RallyScheduleFields({
  rallyDay,
  rallyTime,
  disabled = false,
  onRallyDayChange,
  onRallyTimeChange,
  dayActions,
}: RallyScheduleFieldsProps) {
  return (
    <div className="space-y-3">
      {dayActions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{dayActions}</div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Day</p>
        <div
          className="inline-flex rounded-full border border-border bg-page p-1"
          role="tablist"
          aria-label="Rally day"
        >
          <button
            type="button"
            role="tab"
            aria-selected={rallyDay === 'today'}
            className={chipClass(rallyDay === 'today')}
            disabled={disabled}
            onClick={() => onRallyDayChange('today')}
          >
            Today
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rallyDay === 'tomorrow'}
            className={chipClass(rallyDay === 'tomorrow')}
            disabled={disabled}
            onClick={() => onRallyDayChange('tomorrow')}
          >
            Tomorrow
          </button>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Scheduled time</span>
        <input
          className="input-field"
          type="time"
          value={rallyTime}
          disabled={disabled}
          onChange={(event) => onRallyTimeChange(event.target.value)}
          required
        />
      </label>
    </div>
  );
}
