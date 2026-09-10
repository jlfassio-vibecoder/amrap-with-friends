import { findAmqapFlow } from '@/data/amqapFlows';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';

/**
 * Display title for the mission workout card. Built-in library and AMQAP
 * templates resolve by template_id; custom and unresolved coach ids fall back
 * to "Workout".
 */
export function resolveWorkoutTitle(templateId: string | null | undefined): string {
  if (!templateId) {
    return 'Workout';
  }
  const builtIn = WORKOUT_TEMPLATES.find((template) => template.id === templateId);
  if (builtIn) {
    return builtIn.name;
  }
  const amqap = findAmqapFlow(templateId);
  return amqap?.name ?? 'Workout';
}
