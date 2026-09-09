import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { callRpc } from '@/lib/api/callRpc';
import { buildCaption } from '@/lib/share/caption';
import { cardFileName, renderCardBlob } from '@/lib/share/renderCard';
import { createShareId, shareUrl } from '@/lib/share/shareId';
import { shareArtifact } from '@/lib/share/shareSheet';
import { uploadShareImage } from '@/lib/share/uploadShareImage';
import { frameAt, myBar, resolveVariant } from '@/lib/share/timeline';
import { cardMovements, roundSplits, shouldDrawBoard } from '@/lib/share/cardContent';
import { photoRejectionReason } from '@/lib/share/photo';
import { defaultCut } from '@/lib/share/cuts';
import {
  detectEncoderPath,
  isEncoderImplemented,
  readCapabilities,
  replayActionLabel,
  replayCaveat,
} from '@/lib/share/replay/encoderPath';
import { replayFileName } from '@/lib/share/replay/renderReplay';
import { useReplay } from '@/lib/share/replay/useReplay';
import type { ReplayData, ShareLayout, ShareVariant } from '@/lib/share/types';

const LAYOUT_OPTIONS: { id: ShareLayout; label: string }[] = [
  { id: 'story', label: '9:16' },
  { id: 'square', label: '1:1' },
  { id: 'landscape', label: '16:9' },
];

interface ShareCardPanelProps {
  data: ReplayData;
  workoutTitle: string;
  /** Guest credentials, so a guest can create their share without an account. */
  participantId?: string | null;
  claimToken?: string | null;
  hostToken?: string | null;
}

export function ShareCardPanel({
  data,
  workoutTitle,
  participantId,
  claimToken,
  hostToken,
}: ShareCardPanelProps) {
  const [layout, setLayout] = useState<ShareLayout>('story');
  const [variant, setVariant] = useState<ShareVariant>('result');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Detected once: the answer cannot change while the panel is open, and
  // probing per render would run a feature test on every keystroke.
  const [encoderPath] = useState(() => detectEncoderPath(readCapabilities()));
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Off by default. A photo of a person going to a public URL should be a
  // decision somebody made, not one they failed to notice.
  const [publishPhoto, setPublishPhoto] = useState(false);

  // Decoded once into an ImageBitmap rather than kept as a File: the renderer
  // draws it on every ratio change, and re-decoding a 12MP photo each time is
  // what would make the toggle feel slow.
  const handlePhoto = useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const rejection = photoRejectionReason(file);
    if (rejection) {
      setPhotoError(rejection);
      return;
    }
    setPhotoError(null);
    try {
      // from-image so a photo taken sideways is not drawn sideways.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      setPhoto((previous) => {
        previous?.close();
        return bitmap;
      });
    } catch {
      setPhotoError('That photo could not be read.');
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhoto((previous) => {
      previous?.close();
      return null;
    });
  }, []);

  useEffect(() => () => photo?.close(), [photo]);

  // One id for the life of the panel: re-rendering at another ratio is the
  // same share, and a new id per ratio would fragment the view count. Lazy
  // useState rather than a ref, because this is a stable value rather than
  // mutable state, and reading a ref during render is not allowed.
  const [shareId] = useState(createShareId);

  const effectiveVariant = resolveVariant(data, variant);
  const blobRef = useRef<Map<string, Blob>>(new Map());
  const bar = useMemo(() => myBar(frameAt(data).bars), [data]);

  const caption = useMemo(
    () =>
      buildCaption({
        bar,
        workoutTitle,
        durationMinutes: data.mission.durationMinutes,
        shareId,
        squadSize: data.participants.length,
      }),
    [bar, workoutTitle, data.mission.durationMinutes, data.participants.length, shareId]
  );

  const me = useMemo(() => data.participants.find((entry) => entry.isMe) ?? null, [data]);
  // Total reps, the way the scorecard counts them: whole rounds plus the
  // partial. Derived rather than fetched — the reps per round are the sum of
  // the workout's own movements.
  const repsPerRound = useMemo(
    () => cardMovements(data).reduce((sum, movement) => sum + (movement.reps ?? 0), 0),
    [data]
  );

  const drawOptions = useMemo(
    () => ({
      layout,
      variant: effectiveVariant,
      title: workoutTitle,
      subtitle: `${data.mission.durationMinutes} min AMRAP`,
      shareUrl: shareUrl(shareId),
      // Every card carries it for now: there is no athlete tier to exempt.
      watermark: true,
      movements: cardMovements(data),
      splits: me ? roundSplits(data.rounds, me.participantId) : [],
      totalReps: me ? me.finalRounds * repsPerRound + me.finalReps : null,
      finalScore: me?.finalScore ?? null,
      showBoard: shouldDrawBoard(data),
      photo,
      photoWidth: photo?.width,
      photoHeight: photo?.height,
    }),
    [layout, effectiveVariant, workoutTitle, data, me, repsPerRound, shareId, photo]
  );

  // Recorded when a share actually happens, with what was actually shared.
  // On mount it always logged story/result regardless of the ratio chosen, and
  // logged for athletes who never shared at all — which would have made the
  // phase 3 view counts wrong before they existed.
  const recordedRef = useRef(false);
  const recordShare = useCallback(
    (kind: 'card' | 'replay') => {
      if (recordedRef.current) {
        return;
      }
      recordedRef.current = true;
      // The card goes up alongside the row so /s/ can unfurl with it. Only the
      // story ratio: it is what the link preview crops to, and uploading three
      // versions of one card would triple the storage for no visible gain.
      //
      // Never when the card carries the athlete's photo. The bucket is public
      // and a share id, while unguessable, is printed on the card itself — so
      // uploading would put a picture of a person at a URL that anyone holding
      // the image can read off it. Posting the photo is the athlete's choice
      // to make in the share sheet, once, not a side effect of tapping Copy
      // link. The link still works; it unfurls with the generic card.
      const storyBlob =
        photo && !publishPhoto ? null : blobRef.current.get(`story:${effectiveVariant}`);
      if (storyBlob) {
        void uploadShareImage({
          shareId,
          blob: storyBlob,
          participantId,
          claimToken,
          hostToken,
        });
      }
      async function record(attempt = 0): Promise<void> {
        const { error } = await callRpc('create_mission_share', {
          p_id: shareId,
          p_mission_id: data.mission.id,
          p_participant_id: participantId ?? null,
          p_kind: kind,
          p_layout: layout,
          p_variant: effectiveVariant,
          p_claim_token: claimToken ?? null,
          p_host_token: hostToken ?? null,
        });
        if (error && attempt === 0) {
          await record(1);
        }
      }
      // Not awaited: the share sheet has to stay inside the user's gesture, and
      // the card is useful whether or not the row lands.
      void record();
    },
    [
      shareId,
      data.mission.id,
      participantId,
      layout,
      effectiveVariant,
      claimToken,
      hostToken,
      photo,
      publishPhoto,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const key = `${layout}:${effectiveVariant}`;
    const startedAt = performance.now();

    async function render(): Promise<void> {
      const cached = blobRef.current.get(key);
      const blob = cached ?? (await renderCardBlob(data, drawOptions));
      if (!blob || cancelled) {
        return;
      }
      if (!cached) {
        blobRef.current.set(key, blob);
        track('share_card_rendered', {
          layout,
          variant: effectiveVariant,
          duration_ms: Math.round(performance.now() - startedAt),
        });
      }
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(blob);
      });
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [data, drawOptions, layout, effectiveVariant]);

  useEffect(() => {
    const urls = blobRef.current;
    return () => {
      urls.clear();
    };
  }, []);

  const replay = useReplay(data, drawOptions);
  const cutId = defaultCut(data.participants.length);

  const handleShareReplay = useCallback(async () => {
    if (!replay.blob) {
      return;
    }
    recordShare('replay');
    // Already encoded, so navigator.share is still inside this click. Awaiting
    // the encode here instead would make iOS refuse the sheet.
    const file = new File([replay.blob], replayFileName(shareId, cutId), { type: 'video/mp4' });
    const result = await shareArtifact({
      file,
      caption,
      shareId,
      kind: 'replay',
      layout,
    });
    if (result.outcome === 'downloaded') {
      setNotice('Saved to your downloads. Caption copied.');
    }
  }, [replay.blob, shareId, cutId, caption, layout, recordShare]);

  const handleShare = useCallback(async () => {
    const blob = blobRef.current.get(`${layout}:${effectiveVariant}`);
    if (!blob) {
      return;
    }
    setBusy(true);
    recordShare('card');
    // Already rendered, so navigator.share is still inside the click. Awaiting
    // a render here would make iOS reject the sheet.
    const file = new File([blob], cardFileName(shareId, layout), { type: 'image/png' });
    const result = await shareArtifact({ file, caption, shareId, kind: 'card', layout });
    setBusy(false);
    if (result.outcome === 'downloaded') {
      setNotice('Saved. Caption copied — paste it when you post.');
    }
  }, [layout, effectiveVariant, shareId, caption, recordShare]);

  const handleCopyLink = useCallback(async () => {
    recordShare('card');
    try {
      await navigator.clipboard.writeText(caption);
      setNotice('Caption and link copied.');
    } catch {
      setNotice(`Copy this: ${shareUrl(shareId)}`);
    }
  }, [caption, shareId, recordShare]);

  return (
    <section className="card space-y-4 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Share your result
        </h3>
        <p className="text-xs text-secondary">
          Your name appears on your squad&rsquo;s share cards.
        </p>
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Share card preview"
          className="mx-auto max-h-[420px] w-auto rounded-card border border-border"
        />
      ) : (
        <p className="text-sm text-secondary">Building your card…</p>
      )}

      <div className="flex flex-wrap gap-2">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={layout === option.id}
            onClick={() => setLayout(option.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              layout === option.id
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface text-secondary'
            }`}
          >
            {option.label}
          </button>
        ))}
        {data.participants.length > 1 ? (
          <button
            type="button"
            aria-pressed={variant === 'squad'}
            onClick={() => setVariant(variant === 'squad' ? 'result' : 'squad')}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              variant === 'squad'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface text-secondary'
            }`}
          >
            Squad board
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-outline cursor-pointer text-sm">
          {photo ? 'Change photo' : 'Add a photo'}
          {/* `capture` opens the camera straight away on a phone, which is
              where somebody is standing when they finish. */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
        </label>
        {photo ? (
          <button type="button" className="btn-outline text-sm" onClick={clearPhoto}>
            Remove photo
          </button>
        ) : null}
      </div>

      {photoError ? <p className="text-xs text-secondary">{photoError}</p> : null}
      {photo ? (
        <div className="space-y-2 rounded-card border border-border p-3">
          <label className="flex items-start gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={publishPhoto}
              onChange={(event) => setPublishPhoto(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Show my photo in the link preview. Off by default — the share link is public, so
              anyone who opens it would see the photo. Leave it off and the card is still yours to
              post wherever you like; only the link preview uses the plain card.
            </span>
          </label>
          <p className="text-xs text-secondary">
            Either way the photo is drawn on this device. It is never uploaded unless you tick this.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!previewUrl || busy}
          onClick={handleShare}
        >
          Share
        </button>
        <button type="button" className="btn-outline text-sm" onClick={handleCopyLink}>
          Copy link
        </button>
      </div>

      {isEncoderImplemented(encoderPath) ? (
        <div className="space-y-2 border-t border-border pt-4">
          {replay.status === 'idle' || replay.status === 'error' ? (
            <button
              type="button"
              className="btn-outline text-sm"
              onClick={() => replay.start(cutId)}
            >
              Make replay
            </button>
          ) : null}

          {replay.status === 'rendering' ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary">
                {replay.progress < 1
                  ? `Rendering ${Math.round(replay.progress * 100)}%`
                  : 'Encoding…'}
              </p>
              <button type="button" className="btn-outline text-sm" onClick={replay.cancel}>
                Cancel
              </button>
            </div>
          ) : null}

          {replay.status === 'ready' ? (
            <button type="button" className="btn-primary text-sm" onClick={handleShareReplay}>
              {replayActionLabel(encoderPath)}
            </button>
          ) : null}

          {/* Said before a thirty-second render, not after it. */}
          {replayCaveat(encoderPath) ? (
            <p className="text-xs text-secondary">{replayCaveat(encoderPath)}</p>
          ) : null}
          {replay.error ? <p className="text-xs text-secondary">{replay.error}</p> : null}
        </div>
      ) : null}

      {!isEncoderImplemented(encoderPath) && replayCaveat(encoderPath) ? (
        <p className="text-xs text-secondary">{replayCaveat(encoderPath)}</p>
      ) : null}

      {notice ? <p className="text-xs text-secondary">{notice}</p> : null}
    </section>
  );
}
