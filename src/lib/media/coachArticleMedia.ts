import { getSupabaseClient } from '@/lib/supabase';

export const COACH_ARTICLE_MEDIA_BUCKET = 'coach-article-media';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type UploadCoachArticleImageResult =
  { path: string; error: null } | { path: null; error: string };

/** Resolve a relative path in the coach-article-media bucket to a public URL. */
export function getCoachArticleMediaUrl(relativePath: string): string {
  const path = relativePath.trim();
  if (!path) {
    return '';
  }

  const { data } = getSupabaseClient().storage.from(COACH_ARTICLE_MEDIA_BUCKET).getPublicUrl(path);

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

/** Uploads one article photo under the coach's own folder and returns the
 * relative storage path to store on the coach_articles.photos jsonb. */
export async function uploadCoachArticlePhoto(
  ownerId: string,
  articleId: string,
  photoId: string,
  file: File
): Promise<UploadCoachArticleImageResult> {
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

  const sessionOwnerId = session.user.id;
  if (ownerId && ownerId !== sessionOwnerId) {
    return { path: null, error: 'Sign in to upload images.' };
  }

  const path = `${sessionOwnerId}/${articleId}/${photoId}${fileExtension(file)}`;

  try {
    const body = await readFileBytes(file);

    const attemptUpload = async () =>
      client.storage.from(COACH_ARTICLE_MEDIA_BUCKET).upload(path, body, {
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
        console.warn('coach article photo upload failed', error.message);
      }
      return { path: null, error: mapUploadError(error.message) };
    }

    return { path, error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : undefined;
    if (import.meta.env.DEV) {
      console.warn('coach article photo upload threw', message);
    }
    return { path: null, error: mapUploadError(message) };
  }
}
