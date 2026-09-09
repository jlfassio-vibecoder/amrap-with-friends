import { callRpc } from '@/lib/api/callRpc';
import { supabase } from '@/lib/supabase';
import { MAX_OG_IMAGE_BYTES, extensionForType } from '@/lib/share/ogImage';

export const SHARE_BUCKET = 'mission-shares';
export { MAX_OG_IMAGE_BYTES as MAX_SHARE_IMAGE_BYTES } from '@/lib/share/ogImage';

/**
 * The storage policy matches `{shareId}.png|webp` and nothing else, so the
 * extension comes from the blob's own type rather than a hardcoded png — a
 * webp written to a .png key is a 403 at upload time.
 */
export function shareImagePath(shareId: string, type = 'image/png'): string {
  const extension = extensionForType(type);
  return extension ? `${shareId}.${extension}` : `${shareId}.png`;
}

export function shareImageUrl(supabaseUrl: string, imagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${SHARE_BUCKET}/${imagePath}`;
}

/**
 * Put the card where a link preview can fetch it.
 *
 * Fire-and-forget by design: the athlete already has the image in the share
 * sheet, and an upload failure costs a link preview later, not the share now.
 * Never awaited on the path to navigator.share, which has to stay inside the
 * user's gesture.
 *
 * Upload is insert-only against an unguessable 8-character id, and
 * set_mission_share_image only fills an empty image_path — so the picture
 * behind a link already in circulation cannot be swapped.
 */
export async function uploadShareImage(input: {
  shareId: string;
  blob: Blob;
  participantId?: string | null;
  claimToken?: string | null;
  hostToken?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (input.blob.size > MAX_OG_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  if (!extensionForType(input.blob.type)) {
    return { ok: false, reason: 'unsupported_type' };
  }

  const path = shareImagePath(input.shareId, input.blob.type);
  const { error } = await supabase.storage.from(SHARE_BUCKET).upload(path, input.blob, {
    contentType: input.blob.type,
    // Never overwrite: the image is what somebody already posted.
    upsert: false,
  });

  // A duplicate means this card was already uploaded — the row still needs
  // pointing at it, so this is success, not failure.
  const alreadyThere = error?.message?.toLowerCase().includes('exists') === true;
  if (error && !alreadyThere) {
    return { ok: false, reason: error.message };
  }

  const { error: rpcError } = await callRpc('set_mission_share_image', {
    p_share_id: input.shareId,
    p_image_path: path,
    p_participant_id: input.participantId ?? null,
    p_claim_token: input.claimToken ?? null,
    p_host_token: input.hostToken ?? null,
  });

  return rpcError ? { ok: false, reason: rpcError.message } : { ok: true };
}
