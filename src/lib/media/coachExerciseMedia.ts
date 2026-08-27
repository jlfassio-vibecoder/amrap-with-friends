import { getSupabaseClient } from '@/lib/supabase';

export const COACH_EXERCISE_MEDIA_BUCKET = 'coach-exercise-media';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type UploadCoachExerciseImageResult =
  | { path: string; error: null }
  | { path: null; error: string };

/** Resolve a relative path in the coach-exercise-media bucket to a public URL. */
export function getCoachExerciseMediaUrl(relativePath: string): string {
  const path = relativePath.trim();
  if (!path) {
    return '';
  }

  const { data } = getSupabaseClient()
    .storage.from(COACH_EXERCISE_MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

function fileExtension(file: File): string {
  const match = file.name.match(/\.[a-zA-Z0-9]+$/);
  if (match) {
    return match[0].toLowerCase();
  }
  return file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
}

/** Uploads one exercise photo under the coach's own folder and returns the
 * relative storage path to store on the coach_exercises row. Each photo
 * gets its own id so an exercise can hold multiple photos side by side. */
export async function uploadCoachExercisePhoto(
  ownerId: string,
  exerciseId: string,
  photoId: string,
  file: File
): Promise<UploadCoachExerciseImageResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { path: null, error: 'Image must be JPEG, PNG, or WebP.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { path: null, error: 'Image must be 5MB or smaller.' };
  }

  const path = `${ownerId}/${exerciseId}/${photoId}${fileExtension(file)}`;

  const { error } = await getSupabaseClient()
    .storage.from(COACH_EXERCISE_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    return { path: null, error: 'Image upload failed. Please try again.' };
  }

  return { path, error: null };
}
