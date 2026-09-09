import { callRpc } from '@/lib/api/callRpc';
import { supabase } from '@/lib/supabase';

export const SHARE_BUCKET = 'mission-shares';
/** Matches the bucket's own limit, so an oversized file fails here with a reason rather than at the API. */
export const MAX_SHARE_IMAGE_BYTES = 400 * 1024;

export function shareImagePath(shareId: string): string {
  return `${shareId}.png`;
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
  if (input.blob.size > MAX_SHARE_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const path = shareImagePath(input.shareId);
  const { error } = await supabase.storage.from(SHARE_BUCKET).upload(path, input.blob, {
    contentType: 'image/png',
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
