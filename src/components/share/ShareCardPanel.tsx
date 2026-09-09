import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { callRpc } from '@/lib/api/callRpc';
import { buildCaption } from '@/lib/share/caption';
import { cardFileName, renderCardBlob } from '@/lib/share/renderCard';
import { createShareId, shareUrl } from '@/lib/share/shareId';
import { shareArtifact } from '@/lib/share/shareSheet';
import { frameAt, myBar, resolveVariant } from '@/lib/share/timeline';
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

  const drawOptions = useMemo(
    () => ({
      layout,
      variant: effectiveVariant,
      title: workoutTitle,
      subtitle: `${data.mission.durationMinutes} min AMRAP`,
      shareUrl: shareUrl(),
      // Every card carries it for now: there is no athlete tier to exempt.
      watermark: true,
    }),
    [layout, effectiveVariant, workoutTitle, data.mission.durationMinutes]
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
    [shareId, data.mission.id, participantId, layout, effectiveVariant, claimToken, hostToken]
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
      setNotice(`Copy this: ${shareUrl()}`);
    }
  }, [caption, recordShare]);

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
