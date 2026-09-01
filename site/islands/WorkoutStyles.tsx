import { useState } from 'react';
import { WorkoutStyleInfoModal } from '@/components/workoutStyle/WorkoutStyleInfoModal';
import { WORKOUT_CATEGORIES, type WorkoutCategory } from '@/data/workoutTemplates';
import { categoryPath } from '@/lib/seo/contentPages';

/**
 * The style chips and their modal. Browse goes to the Astro style collection
 * page (full navigation — no Router in this island).
 */
export default function WorkoutStyles() {
  const [infoCategory, setInfoCategory] = useState<WorkoutCategory | null>(null);

  function handleBrowse(category: WorkoutCategory) {
    window.location.assign(categoryPath(category));
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
