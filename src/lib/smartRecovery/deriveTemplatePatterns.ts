import { getExerciseInfo } from '@/data/exerciseLibrary';
import type { WorkoutCategory, WorkoutTemplate } from '@/data/workoutTemplates';
import {
  CATEGORY_DEFAULT_PATTERNS,
  type MovementPattern,
} from '@/lib/smartRecovery/movementPatterns';

const TOP_PATTERN_COUNT = 2;

function categoryFallbackPatterns(category: WorkoutCategory | null): MovementPattern[] {
  if (!category) {
    return [];
  }
  return CATEGORY_DEFAULT_PATTERNS[category];
}

function topPatternsByFrequency(counts: Map<MovementPattern, number>): MovementPattern[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_PATTERN_COUNT)
    .map(([pattern]) => pattern);
}

function addPatternCounts(counts: Map<MovementPattern, number>, patterns: MovementPattern[]): void {
  for (const pattern of patterns) {
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
}

export function deriveTemplatePrimaryPatterns(template: WorkoutTemplate): MovementPattern[] {
  const counts = new Map<MovementPattern, number>();
  const categoryFallback = categoryFallbackPatterns(template.category);

  for (const movement of template.movements) {
    const exercise = getExerciseInfo(movement.name);
    const patterns = exercise?.primaryPatterns ?? categoryFallback;
    addPatternCounts(counts, patterns);
  }

  if (counts.size === 0) {
    return categoryFallback.slice(0, TOP_PATTERN_COUNT);
  }

  return topPatternsByFrequency(counts);
}

export function buildTemplatePatternIndex(
  templates: WorkoutTemplate[]
): Map<string, MovementPattern[]> {
  return new Map(
    templates.map((template) => [template.id, deriveTemplatePrimaryPatterns(template)])
  );
}
