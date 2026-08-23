import { getSupabaseClient } from '@/lib/supabase';

export const EXERCISE_MEDIA_BUCKET = 'exercise-media';

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
