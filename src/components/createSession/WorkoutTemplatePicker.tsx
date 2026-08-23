import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import {
  filterWorkoutTemplates,
  isCategoryAvailable,
  isDurationAvailable,
  categoriesForDuration,
} from '@/lib/workout/filterWorkoutTemplates';
import { WorkoutTemplateCard } from '@/components/createSession/WorkoutTemplateCard';

interface WorkoutTemplatePickerProps {
  durationMinutes: TimeDomain;
  selectedCategory: WorkoutCategory;
  selectedTemplateId: string | null;
  onDurationChange: (duration: TimeDomain) => void;
  onCategoryChange: (category: WorkoutCategory) => void;
  onTemplateSelect: (template: WorkoutTemplate) => void;
}

export function WorkoutTemplatePicker({
  durationMinutes,
  selectedCategory,
  selectedTemplateId,
  onDurationChange,
  onCategoryChange,
  onTemplateSelect,
}: WorkoutTemplatePickerProps) {
  const visibleTemplates = filterWorkoutTemplates(WORKOUT_TEMPLATES, {
    durationMinutes,
    category: selectedCategory,
  });
  const visibleCategories = categoriesForDuration(WORKOUT_CATEGORIES, durationMinutes);
  const selectedCategoryMeta = visibleCategories.find(
    (category) => category.id === selectedCategory
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Time domain
        </p>
        <div className="flex flex-wrap gap-2">
          {TIME_DOMAINS.map((duration) => {
            const available = isDurationAvailable(duration, WORKOUT_TEMPLATES);
            const selected = durationMinutes === duration;

            return (
              <button
                key={duration}
                type="button"
                disabled={!available}
                className={
                  selected
                    ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
                    : available
                      ? 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-accent/40'
                      : 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted opacity-60'
                }
                onClick={() => onDurationChange(duration)}
              >
                {duration} min
                {!available ? <span className="ml-1 text-xs uppercase">Soon</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Category</p>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => {
            const available = isCategoryAvailable(
              category,
              durationMinutes,
              WORKOUT_TEMPLATES
            );
            const selected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                disabled={!available}
                className={
                  selected
                    ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
                    : available
                      ? 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-accent/40'
                      : 'rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted opacity-60'
                }
                onClick={() => onCategoryChange(category.id)}
              >
                {category.label}
                {!available ? <span className="ml-1 text-xs uppercase">Soon</span> : null}
              </button>
            );
          })}
        </div>
        {selectedCategoryMeta ? (
          <p className="text-sm text-secondary">{selectedCategoryMeta.description}</p>
        ) : null}
      </div>

      <div className="max-h-[32rem] overflow-y-auto pr-1">
        {visibleTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleTemplates.map((template) => (
              <WorkoutTemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplateId === template.id}
                onSelect={onTemplateSelect}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-page p-4 text-sm text-secondary">
            No workouts available for this time domain and category yet.
          </p>
        )}
      </div>
    </div>
  );
}
