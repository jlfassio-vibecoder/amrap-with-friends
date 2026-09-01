import { useState } from 'react';
import { WorkoutStyleInfoModal } from '@/components/workoutStyle/WorkoutStyleInfoModal';
import { WORKOUT_CATEGORIES, type TimeDomain, type WorkoutCategory } from '@/data/workoutTemplates';

/**
 * The style chips and their modal. There is no Router here, so browsing a style
 * is a real navigation into the SPA rather than a client-side route change.
 */
export default function WorkoutStyles() {
  const [infoCategory, setInfoCategory] = useState<WorkoutCategory | null>(null);

  function handleBrowse(category: WorkoutCategory, durationMinutes?: TimeDomain) {
    const params = new URLSearchParams({ category });
    if (durationMinutes !== undefined) {
      params.set('duration', String(durationMinutes));
    }
    window.location.assign(`/create?${params.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {WORKOUT_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className="hover:border-accent/40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:text-ink"
            onClick={() => setInfoCategory(category.id)}
          >
            {category.label} — {category.availableForDurations.join(', ')} min
          </button>
        ))}
      </div>

      {infoCategory ? (
        <WorkoutStyleInfoModal
          category={infoCategory}
          onClose={() => setInfoCategory(null)}
          onBrowse={handleBrowse}
        />
      ) : null}
    </>
  );
}
