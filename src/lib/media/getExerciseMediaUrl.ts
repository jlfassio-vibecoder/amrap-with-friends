import { getSupabaseClient } from '@/lib/supabase';

export const EXERCISE_MEDIA_BUCKET = 'exercise-media';

/** Accepted sequence still extensions (Gemini `.jpeg`, ChatGPT `.png`, plus `.jpg`). */
const IMAGE_EXTENSIONS = ['.jpeg', '.png', '.jpg'] as const;

/**
 * Paths to try for a sequence still when the stored object may be `.jpeg`,
 * `.png`, or `.jpg`. Keeps the requested extension first, then the other
 * accepted formats.
 */
export function getExerciseImagePathCandidates(relativePath: string): string[] {
  const path = relativePath.trim();
  if (!path) {
    return [];
  }

  const match = path.match(/^(.*)(\.(?:jpe?g|png))$/i);
  if (!match) {
    return [path];
  }

  const stem = match[1];
  const primaryExt = match[2].toLowerCase() as (typeof IMAGE_EXTENSIONS)[number];
  const alternates = IMAGE_EXTENSIONS.filter((ext) => ext !== primaryExt);
  return [`${stem}${primaryExt}`, ...alternates.map((ext) => `${stem}${ext}`)];
}

/** Resolve a relative path in the exercise-media bucket to a public URL. */
export function getExerciseMediaUrl(relativePath: string): string {
  const path = relativePath.trim();
  if (!path) {
    return '';
  }

  const { data } = getSupabaseClient()
    .storage.from(EXERCISE_MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
