import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { callRpc } from '@/lib/api/callRpc';
import { buildCaption } from '@/lib/share/caption';
import { cardFileName, renderCardBlob } from '@/lib/share/renderCard';
import { OG_ENCODINGS, OG_LAYOUT, OG_WIDE_LAYOUT, fitsOgLimit } from '@/lib/share/ogImage';
import { createShareId, shareUrl } from '@/lib/share/shareId';
import { shareArtifact } from '@/lib/share/shareSheet';
import { uploadShareImage } from '@/lib/share/uploadShareImage';
import { frameAt, myBar, resolveVariant } from '@/lib/share/timeline';
import { cardMovements, roundSplits, shouldDrawBoard } from '@/lib/share/cardContent';
import {
  photoRejectionReason,
  slotForLayout,
  slotsForTarget,
  type PhotoSlot,
  type PhotoTarget,
} from '@/lib/share/photo';
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

const PHOTO_TARGET_OPTIONS: { id: PhotoTarget; label: string }[] = [
  { id: 'portrait', label: 'Tall card' },
  { id: 'wide', label: 'Wide card' },
  { id: 'both', label: 'Both' },
];

const PHOTO_SLOT_LABELS: { id: PhotoSlot; label: string }[] = [
  { id: 'portrait', label: 'Tall card' },
  { id: 'wide', label: 'Wide card' },
];

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
  // One photo per card shape. The wide card crops a 3:4 phone photo to a band
  // out of its middle, so the shot that works on the tall card arrives on X as
  // a torso — the athlete needs to be able to say which photo goes where, or
  // to say one is fine for both and accept that knowingly.
  const [photos, setPhotos] = useState<Record<PhotoSlot, ImageBitmap | null>>({
    portrait: null,
    wide: null,
  });
  // Which slots the next upload fills. Both by default: most athletes have one
  // photo and one photo is the thing they expect to end up on their card.
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget>('both');
  // Bumped whenever a photo changes. Rendered blobs are cached by ratio and
  // variant; without this in the key, adding a photo hands back the cached
  // photo-less card and nothing appears to happen.
  const [photoToken, setPhotoToken] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Off by default. A photo of a person going to a public URL should be a
  // decision somebody made, not one they failed to notice.
  const [publishPhoto, setPublishPhoto] = useState(false);

  // Decoded once into an ImageBitmap rather than kept as a File: the renderer
  // draws it on every ratio change, and re-decoding a 12MP photo each time is
  // what would make the toggle feel slow.
  const handlePhoto = useCallback(async (file: File | undefined, target: PhotoTarget) => {
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
      const slots = slotsForTarget(target);
      setPhotos((previous) => {
        const next = { ...previous };
        for (const slot of slots) {
          // Closed only if nothing else still points at it: one bitmap fills
          // both slots when the target is `both`, and closing it while the
          // other slot holds it would blank that card.
          const outgoing = previous[slot];
          if (outgoing && !slots.some((other) => other !== slot && previous[other] === outgoing)) {
            outgoing.close();
          }
          next[slot] = bitmap;
        }
        return next;
      });
      setPhotoToken((token) => token + 1);
    } catch {
      setPhotoError('That photo could not be read.');
    }
  }, []);

  const clearPhoto = useCallback((slot: PhotoSlot) => {
    setPhotos((previous) => {
      const outgoing = previous[slot];
      const other: PhotoSlot = slot === 'portrait' ? 'wide' : 'portrait';
      // Shared bitmap: dropping one slot must not close it under the other.
      if (outgoing && previous[other] !== outgoing) {
        outgoing.close();
      }
      return { ...previous, [slot]: null };
    });
    setPhotoToken((token) => token + 1);
  }, []);

  // Close on unmount, once per distinct bitmap. The ref is written in an
  // effect rather than during render: reading or writing one while rendering
  // is what the compiler bails out on, and a bailout here would cost the
  // memoisation the whole preview depends on.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      const open = new Set(Object.values(photosRef.current).filter(Boolean));
      for (const bitmap of open) {
        bitmap?.close();
      }
    },
    []
  );

  // One id for the life of the panel: re-rendering at another ratio is the
  // same share, and a new id per ratio would fragment the view count. Lazy
  // useState rather than a ref, because this is a stable value rather than
  // mutable state, and reading a ref during render is not allowed.
  const [shareId] = useState(createShareId);

  const hasAnyPhoto = photos.portrait !== null || photos.wide !== null;

  const effectiveVariant = resolveVariant(data, variant);
  const blobRef = useRef<Map<string, Blob>>(new Map());

  // Every cached blob was drawn with the photo that was set at the time, so a
  // change invalidates all of them at once.
  useEffect(() => {
    blobRef.current.clear();
  }, [photoToken]);

  const cacheKey = useCallback(
    (ratio: ShareLayout) => `${ratio}:${effectiveVariant}:${photoToken}`,
    [effectiveVariant, photoToken]
  );
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
      // The ratio on screen decides which photo is drawn, so flipping to 16:9
      // shows the athlete what X will actually get rather than a promise.
      photo: photos[slotForLayout(layout)],
      photoWidth: photos[slotForLayout(layout)]?.width,
      photoHeight: photos[slotForLayout(layout)]?.height,
    }),
    [layout, effectiveVariant, workoutTitle, data, me, repsPerRound, shareId, photos]
  );

  // The link preview gets its own render, in landscape.
  //
  // A crawler crops og:image to roughly 1.91:1, so the story card it used
  // to receive arrived as a band out of its middle with the hero, the
  // workout and the chart all outside the crop. Landscape is 1.78:1 and
  // survives it. This is a second render rather than a reuse of one on
  // screen, because the athlete may never have opened that ratio.
  //
  // Whether the photo goes with it is the athlete's decision. Unticked,
  // the preview gets the same card drawn without it — the bucket is public
  // and the share id is printed on the card, so publishing would put a
  // picture of a person at a URL anyone holding the image can read off it.
  // What it must not do is fall back to the site logo, which is what the
  // athlete actually saw before this: their result is not private, only
  // their face is.
  const uploadOgImage = useCallback(async (): Promise<void> => {
    // Encoded at the first format and quality that fits the bucket. Null if
    // none do, which is a card that does not get uploaded rather than one that
    // gets uploaded broken. Each layout draws its own slot's photo, so the
    // wide card sent to X carries the photo chosen for it.
    async function encode(layout: ShareLayout): Promise<Blob | null> {
      const slotPhoto = publishPhoto ? photos[slotForLayout(layout)] : null;
      for (const encoding of OG_ENCODINGS) {
        const blob = await renderCardBlob(
          data,
          {
            ...drawOptions,
            layout,
            photo: slotPhoto,
            photoWidth: slotPhoto?.width,
            photoHeight: slotPhoto?.height,
          },
          encoding
        );
        if (!blob) {
          return null;
        }
        if (fitsOgLimit(blob.size)) {
          return blob;
        }
      }
      return null;
    }

    const blob = await encode(OG_LAYOUT);
    if (!blob) {
      return;
    }
    // The wide card is for X, which crops a portrait one to a band out of its
    // middle. Rendered after the portrait card, and its failure never blocks
    // the upload of the one that matters.
    const wideBlob = await encode(OG_WIDE_LAYOUT);
    await uploadShareImage({
      shareId,
      blob,
      wideBlob,
      participantId,
      claimToken,
      hostToken,
    });
  }, [data, drawOptions, photos, publishPhoto, shareId, participantId, claimToken, hostToken]);

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
      async function record(attempt = 0): Promise<boolean> {
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
          return record(1);
        }
        return !error;
      }

      // Not awaited: the share sheet has to stay inside the user's gesture, and
      // the card is useful whether or not the row lands. The image follows the
      // row rather than racing it — set_mission_share_image needs the row to
      // exist, and when it lost that race the link kept the site logo with no
      // error anybody saw.
      void (async () => {
        if (await record()) {
          await uploadOgImage();
        }
      })();
    },
    [
      shareId,
      data.mission.id,
      participantId,
      layout,
      effectiveVariant,
      claimToken,
      hostToken,
      uploadOgImage,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const key = cacheKey(layout);
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
  }, [data, drawOptions, layout, effectiveVariant, cacheKey]);

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
    const blob = blobRef.current.get(cacheKey(layout));
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
  }, [layout, cacheKey, shareId, caption, recordShare]);

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

      {/* One upload, and the athlete says which card it is for. The tall card
          and the wide card crop a phone photo differently — a head-and-shoulders
          shot that works on the tall one arrives on the wide one as a torso —
          so "both" is the default but never the only option. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Use this photo for
          </span>
          {PHOTO_TARGET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={photoTarget === option.id}
              onClick={() => setPhotoTarget(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                photoTarget === option.id
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface text-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-outline cursor-pointer text-sm">
            {hasAnyPhoto ? 'Add another photo' : 'Add a photo'}
            {/* `capture` opens the camera straight away on a phone, which is
                where somebody is standing when they finish. */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void handlePhoto(event.target.files?.[0], photoTarget);
                // Cleared so choosing the same file again still fires change.
                event.target.value = '';
              }}
            />
          </label>
        </div>

        {hasAnyPhoto ? (
          <ul className="space-y-1">
            {PHOTO_SLOT_LABELS.map((slot) => (
              <li key={slot.id} className="flex items-center gap-2 text-xs text-secondary">
                <span className="min-w-28">{slot.label}</span>
                <span className="text-primary">{photos[slot.id] ? 'photo added' : 'no photo'}</span>
                {photos[slot.id] ? (
                  <button type="button" className="underline" onClick={() => clearPhoto(slot.id)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {photoError ? <p className="text-xs text-secondary">{photoError}</p> : null}
      {hasAnyPhoto ? (
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

      {/* Two ways to send this, and they do not produce the same thing.
          "Share the card" hands over the picture, so what lands is exactly
          what is on screen. "Copy link" sends a URL and lets the app build its
          own preview from it, which is where the shape stops being ours:
          Facebook and Messages show the whole portrait card, X crops any
          preview to a wide strip and has no card type that shows a tall image.
          The athlete cannot be expected to know that, so the buttons say what
          they do rather than both saying "share". */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!previewUrl || busy}
          onClick={handleShare}
        >
          Share the card
        </button>
        <button type="button" className="btn-outline text-sm" onClick={handleCopyLink}>
          Copy link
        </button>
      </div>
      <p className="text-xs text-secondary">
        The card posts as a picture, so it looks the same wherever it lands. A link shows a preview
        instead, and each app crops that its own way.
      </p>

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
