import { getSupabaseClient } from '@/lib/supabase';

export const COACH_EXERCISE_MEDIA_BUCKET = 'coach-exercise-media';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type UploadCoachExerciseImageResult =
  { path: string; error: null } | { path: null; error: string };

/** Resolve a relative path in the coach-exercise-media bucket to a public URL. */
export function getCoachExerciseMediaUrl(relativePath: string): string {
  const path = relativePath.trim();
  if (!path) {
    return '';
  }

  const { data } = getSupabaseClient().storage.from(COACH_EXERCISE_MEDIA_BUCKET).getPublicUrl(path);

  return data.publicUrl;
}

function fileExtension(file: File): string {
  const match = file.name.match(/\.[a-zA-Z0-9]+$/);
  if (match) {
    return match[0].toLowerCase();
  }
  return file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read image bytes.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image bytes.'));
    reader.readAsArrayBuffer(file);
  });
}

function mapUploadError(message: string | undefined): string {
  if (!message) {
    return 'Image upload failed. Please try again.';
  }
  const lower = message.toLowerCase();
  if (
    lower.includes('row-level security') ||
    lower.includes('unauthorized') ||
    lower.includes('not allowed') ||
    lower.includes('jwt')
  ) {
    return 'Image upload was blocked. Sign out, sign back in as a coach, and try again.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('ssl') ||
    lower.includes('mac alert')
  ) {
    return 'Image upload was interrupted. Check your connection and try again.';
  }
  return 'Image upload failed. Please try again.';
}

/** Uploads one exercise photo under the coach's own folder and returns the
 * relative storage path to store on the coach_exercises row. Each photo
 * gets its own id so an exercise can hold multiple photos side by side.
 *
 * Sends the file as an ArrayBuffer (not multipart FormData) so Storage uses a
 * raw binary POST — more reliable with nested paths and flaky TLS middleboxes.
 * Path owner is taken from the live auth mission so RLS folder checks match. */
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

  const client = getSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user?.id) {
    return { path: null, error: 'Sign in to upload images.' };
  }

  // Prefer the JWT subject over the caller-supplied id so the storage RLS
  // folder check `(storage.foldername(name))[1] = auth.uid()` cannot drift.
  const sessionOwnerId = session.user.id;
  if (ownerId && ownerId !== sessionOwnerId) {
    return { path: null, error: 'Sign in to upload images.' };
  }

  const path = `${sessionOwnerId}/${exerciseId}/${photoId}${fileExtension(file)}`;

  try {
    const body = await readFileBytes(file);

    const attemptUpload = async () =>
      client.storage.from(COACH_EXERCISE_MEDIA_BUCKET).upload(path, body, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });

    let { error } = await attemptUpload();
    if (error) {
      const retryable =
        /failed to fetch|network|ssl|mac alert/i.test(error.message) || error.message.length === 0;
      if (retryable) {
        ({ error } = await attemptUpload());
      }
    }

    if (error) {
      if (import.meta.env.DEV) {
        console.warn('coach exercise photo upload failed', error.message);
      }
      return { path: null, error: mapUploadError(error.message) };
    }

    return { path, error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : undefined;
    if (import.meta.env.DEV) {
      console.warn('coach exercise photo upload threw', message);
    }
    return { path: null, error: mapUploadError(message) };
  }
}
