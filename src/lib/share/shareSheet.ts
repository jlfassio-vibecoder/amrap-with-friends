import { track } from '@/lib/analytics/track';

export interface ShareArtifactResult {
  outcome: 'shared' | 'downloaded' | 'cancelled';
}

/**
 * Hand the artifact to the OS.
 *
 * Must be called straight from a click. iOS refuses navigator.share if a
 * promise resolved between the gesture and the call, which is why the card is
 * rendered before this runs rather than inside it.
 */
export async function shareArtifact(input: {
  file: File;
  caption: string;
  shareId: string;
  kind: 'card' | 'replay';
  layout: string;
}): Promise<ShareArtifactResult> {
  const context = { share_id: input.shareId, kind: input.kind, layout: input.layout };
  track('share_opened', context);

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [input.file] });

  if (canShareFiles) {
    try {
      await navigator.share({ files: [input.file], text: input.caption });
      track('share_completed', context);
      return { outcome: 'shared' };
    } catch {
      // A rejection is almost always the user dismissing the sheet. It is not
      // an error worth surfacing, and it is not a completion either.
      return { outcome: 'cancelled' };
    }
  }

  downloadFile(input.file);
  try {
    await navigator.clipboard?.writeText(input.caption);
  } catch {
    /* the download is the useful half; a blocked clipboard must not fail it */
  }
  track('share_completed', { ...context, fallback: 'download' });
  return { outcome: 'downloaded' };
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next tick: Safari cancels the download if the object URL
  // disappears in the same frame as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Put the cards on the athlete's own device.
 *
 * Separate from shareArtifact because the intent is different: that one is
 * "send this somewhere", this one is "keep this". An athlete who has just
 * finished cannot tell that the card exists as a file they own — it looks like
 * something the page is showing them — so the reassurance has to be an action
 * they can see, not a fact stated in prose.
 *
 * A phone gets the share sheet with every card at once, because that is where
 * "Save to Photos" lives. A desktop gets downloads, staggered: browsers treat
 * a burst of programmatic downloads as a popup and block all but the first.
 */
export async function saveArtifacts(input: {
  files: File[];
  shareId: string;
}): Promise<ShareArtifactResult> {
  if (input.files.length === 0) {
    return { outcome: 'cancelled' };
  }
  const context = { share_id: input.shareId, kind: 'card' as const, count: input.files.length };
  track('share_opened', context);

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: input.files });

  if (canShareFiles) {
    try {
      await navigator.share({ files: input.files });
      track('share_completed', { ...context, fallback: 'save' });
      return { outcome: 'shared' };
    } catch {
      return { outcome: 'cancelled' };
    }
  }

  for (const [index, file] of input.files.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    downloadFile(file);
  }
  track('share_completed', { ...context, fallback: 'download' });
  return { outcome: 'downloaded' };
}
