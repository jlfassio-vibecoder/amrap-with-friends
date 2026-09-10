import { EXERCISE_MEDIA_MANIFEST, type ExerciseMediaEntry } from '@/data/exerciseMediaManifest';
import { EXERCISE_MEDIA_BUCKET } from '@/lib/media/getExerciseMediaUrl';

/**
 * Reading the manifest, for the static content pages.
 *
 * `getExerciseMediaUrl` stays the app's route to the same objects; it needs a
 * browser Supabase client, which an Astro page does not have. These build the
 * same public URL from a base instead, so neither side has to guess a URL shape
 * the other does not use.
 */
export interface ResolvedExerciseMedia extends ExerciseMediaEntry {
  src: string;
}

/** The documented public-object URL shape for Supabase Storage. */
export function buildPublicMediaUrl(baseUrl: string, path: string): string {
  const origin = baseUrl.trim().replace(/\/+$/, '');
  const relative = path.trim().replace(/^\/+/, '');
  if (!origin || !relative) {
    return '';
  }
  return `${origin}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${relative}`;
}

/**
 * The image for an exercise, or null when there is nothing to show.
 *
 * Null when the manifest has no entry (no object in the bucket) or when the
 * build has no Supabase URL configured — rendering `src="undefined/..."` on 69
 * pages would be worse than rendering no image at all.
 */
export function resolveExerciseMedia(
  exerciseId: string,
  baseUrl: string | undefined
): ResolvedExerciseMedia | null {
  const entry = EXERCISE_MEDIA_MANIFEST[exerciseId];
  if (!entry || !baseUrl?.trim()) {
    return null;
  }
  const src = buildPublicMediaUrl(baseUrl, entry.path);
  return src ? { ...entry, src } : null;
}

/** "Burpees: the sequence from squat to full extension" — never just the name. */
export function buildMediaAlt(exerciseName: string, caption?: string): string {
  const trimmed = caption?.trim();
  return trimmed ? `${exerciseName}: ${lowerFirst(trimmed)}` : `How to do ${exerciseName}`;
}

function lowerFirst(text: string): string {
  // Leave an acronym or proper noun alone; only a normal sentence gets folded.
  if (text.length > 1 && text[1] === text[1].toUpperCase() && text[1] !== text[1].toLowerCase()) {
    return text;
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}
