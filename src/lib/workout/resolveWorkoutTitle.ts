import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';

/**
 * Display title for the session workout card. Built-in library templates resolve
 * by template_id; custom and unresolved coach ids fall back to "Workout".
 */
export function resolveWorkoutTitle(templateId: string | null | undefined): string {
  if (!templateId) {
    return 'Workout';
  }
  const builtIn = WORKOUT_TEMPLATES.find((template) => template.id === templateId);
  return builtIn?.name ?? 'Workout';
}
