import { MAX_MISSIONS_PER_WEEK, WEEKDAY_SHORT, type CampaignSlot } from '@/lib/campaign';

interface CampaignSlotPickerProps {
  slots: CampaignSlot[];
  onChange: (slots: CampaignSlot[]) => void;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function CampaignSlotPicker({ slots, onChange }: CampaignSlotPickerProps) {
  const selected = new Map(slots.map((slot) => [slot.weekday, slot]));
  const atLimit = slots.length >= MAX_MISSIONS_PER_WEEK;

  function toggleWeekday(weekday: number) {
    if (selected.has(weekday)) {
      onChange(slots.filter((slot) => slot.weekday !== weekday));
      return;
    }
    if (atLimit) {
      return;
    }
    // Reuse the last chosen time so adding a fourth day does not mean
    // retyping the time the other three already share.
    const timeLocal = slots[slots.length - 1]?.timeLocal ?? '18:00';
    onChange([...slots, { weekday, timeLocal }]);
  }

  function setTime(weekday: number, timeLocal: string) {
    onChange(slots.map((slot) => (slot.weekday === weekday ? { ...slot, timeLocal } : slot)));
  }

  const ordered = WEEKDAY_ORDER.filter((weekday) => selected.has(weekday));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Training days</p>
        <p className="text-xs text-secondary">
          Pick 1 to {MAX_MISSIONS_PER_WEEK} days. The same pattern repeats every week.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WEEKDAY_ORDER.map((weekday) => {
          const isSelected = selected.has(weekday);
          const isDisabled = !isSelected && atLimit;
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={isSelected}
              disabled={isDisabled}
              className={
                isSelected
                  ? 'rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-widest text-on-accent'
                  : 'rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink disabled:opacity-40'
              }
              onClick={() => toggleWeekday(weekday)}
            >
              {WEEKDAY_SHORT[weekday]}
            </button>
          );
        })}
      </div>

      {ordered.length > 0 ? (
        <div className="space-y-2">
          {ordered.map((weekday) => {
            const slot = selected.get(weekday);
            if (!slot) {
              return null;
            }
            return (
              <label key={weekday} className="flex items-center gap-3">
                <span className="w-12 text-sm font-semibold text-ink">
                  {WEEKDAY_SHORT[weekday]}
                </span>
                <input
                  type="time"
                  className="input-field max-w-40"
                  value={slot.timeLocal}
                  aria-label={`${WEEKDAY_SHORT[weekday]} start time`}
                  onChange={(event) => setTime(weekday, event.target.value)}
                  required
                />
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-error text-sm">Pick at least one training day.</p>
      )}
    </div>
  );
}
