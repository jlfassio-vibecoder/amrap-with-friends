import type {
  IntensityTier,
  TimeDomain,
  WorkoutCategory,
  WorkoutCategoryMeta,
  WorkoutTemplate,
} from '@/data/workoutTemplates';

export interface WorkoutTemplateFilter {
  durationMinutes: TimeDomain;
  category: WorkoutCategory;
  /** Exact intensity match. Null/undefined = Any. */
  intensityTier?: IntensityTier | null;
  /** When non-empty after normalize, search the whole library (ignore domain/category). */
  nameQuery?: string;
}

/** Trim, lower-case, collapse internal whitespace. */
export function normalizeMissionNameQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function filterWorkoutTemplates(
  templates: WorkoutTemplate[],
  filter: WorkoutTemplateFilter
): WorkoutTemplate[] {
  const nameQuery = normalizeMissionNameQuery(filter.nameQuery ?? '');
  const searching = nameQuery.length > 0;
  const intensity = filter.intensityTier ?? null;

  return templates.filter((template) => {
    if (intensity !== null && template.intensityTier !== intensity) {
      return false;
    }

    if (searching) {
      return normalizeMissionNameQuery(template.name).includes(nameQuery);
    }

    return (
      template.durationMinutes === filter.durationMinutes && template.category === filter.category
    );
  });
}

export function isDurationAvailable(duration: TimeDomain, templates: WorkoutTemplate[]): boolean {
  return templates.some((template) => template.durationMinutes === duration);
}

export function isCategoryAvailable(
  category: WorkoutCategoryMeta,
  durationMinutes: TimeDomain,
  templates: WorkoutTemplate[]
): boolean {
  if (!category.availableForDurations.includes(durationMinutes)) {
    return false;
  }

  return templates.some(
    (template) => template.durationMinutes === durationMinutes && template.category === category.id
  );
}

export function firstAvailableCategoryForDuration(
  categories: WorkoutCategoryMeta[],
  durationMinutes: TimeDomain,
  templates: WorkoutTemplate[]
): WorkoutCategory | null {
  const match = categories.find((category) =>
    isCategoryAvailable(category, durationMinutes, templates)
  );
  return match?.id ?? null;
}

export function categoriesForDuration(
  categories: WorkoutCategoryMeta[],
  durationMinutes: TimeDomain
): WorkoutCategoryMeta[] {
  return categories.filter((category) => category.availableForDurations.includes(durationMinutes));
}

export function categoryDisplayForDuration(
  category: WorkoutCategoryMeta,
  durationMinutes: TimeDomain
): { label: string; description: string } {
  const override = category.overridesByDuration?.[durationMinutes];
  return {
    label: override?.label ?? category.label,
    description: override?.description ?? category.description,
  };
}
