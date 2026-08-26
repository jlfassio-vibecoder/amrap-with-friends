import { useMemo, useState, type FormEvent } from 'react';
import { ACTIVITY_CATEGORIES } from '@/data/activityTypes';
import type { LogPhysicalActivityInput } from '@/lib/api/physicalActivity';

const INTENSITY_OPTIONS: Array<{ tier: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { tier: 1, label: 'Active Recovery' },
  { tier: 2, label: 'Foundational' },
  { tier: 3, label: 'Tactical' },
  { tier: 4, label: 'Crucible' },
  { tier: 5, label: 'Tier 1' },
];

const NOTES_MAX_LENGTH = 280;

function todayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateInputValueToIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

interface PhysicalActivityLogFormProps {
  submitting: boolean;
  onSubmit: (input: LogPhysicalActivityInput) => Promise<{ error: string | null }>;
}

export function PhysicalActivityLogForm({
  submitting,
  onSubmit,
}: PhysicalActivityLogFormProps) {
  const [categoryId, setCategoryId] = useState(ACTIVITY_CATEGORIES[0].id);
  const category = useMemo(
    () => ACTIVITY_CATEGORIES.find((entry) => entry.id === categoryId) ?? ACTIVITY_CATEGORIES[0],
    [categoryId]
  );
  const [activityType, setActivityType] = useState(category.activities[0].id);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [intensityTier, setIntensityTier] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [date, setDate] = useState(todayDateInputValue());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    const nextCategory = ACTIVITY_CATEGORIES.find((entry) => entry.id === nextCategoryId);
    if (nextCategory) {
      setActivityType(nextCategory.activities[0].id);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      setError('Duration must be between 1 and 600 minutes.');
      return;
    }

    const occurredAt = dateInputValueToIso(date);
    if (!occurredAt) {
      setError('Enter a valid date.');
      return;
    }

    const result = await onSubmit({
      activityType,
      durationMinutes: duration,
      intensityTier,
      occurredAt,
      notes: notes.trim() || null,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    setDurationMinutes('30');
    setNotes('');
    setDate(todayDateInputValue());
  }

  return (
    <form className="card space-y-4 p-4" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
        Log physical activity
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Category
          </span>
          <select
            className="input-field"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            {ACTIVITY_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Activity
          </span>
          <select
            className="input-field"
            value={activityType}
            onChange={(event) => setActivityType(event.target.value)}
          >
            {category.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Duration (minutes)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            className="input-field tabular-nums"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Date
          </span>
          <input
            type="date"
            className="input-field"
            value={date}
            max={todayDateInputValue()}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Intensity
        </span>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Intensity">
          {INTENSITY_OPTIONS.map((option) => {
            const selected = intensityTier === option.tier;
            return (
              <button
                key={option.tier}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? 'rounded-card bg-accent px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-on-accent'
                    : 'rounded-card border border-border px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-ink hover:border-accent/40'
                }
                onClick={() => setIntensityTier(option.tier)}
              >
                {option.tier}
                <span className="block text-[10px] font-medium normal-case tracking-normal">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Notes (optional)
        </span>
        <input
          type="text"
          className="input-field"
          value={notes}
          maxLength={NOTES_MAX_LENGTH}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="5k trail run, felt strong"
        />
      </label>

      {error ? <p className="text-error text-sm">{error}</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Logging…' : 'Log activity'}
      </button>
    </form>
  );
}
