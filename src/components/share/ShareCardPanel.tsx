import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { callRpc } from '@/lib/api/callRpc';
import { buildCaption } from '@/lib/share/caption';
import { cardFileName, renderCardBlob } from '@/lib/share/renderCard';
import { createShareId, shareUrl } from '@/lib/share/shareId';
import { shareArtifact } from '@/lib/share/shareSheet';
import { frameAt, myBar, resolveVariant } from '@/lib/share/timeline';
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

  // One id for the life of the panel: re-rendering at another ratio is the
  // same share, and a new id per ratio would fragment the view count.
  const shareIdRef = useRef<string>(createShareId());
  const shareId = shareIdRef.current;

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
      shareUrl: shareUrl(shareId),
      // Every card carries it for now: there is no athlete tier to exempt.
      watermark: true,
    }),
    [layout, effectiveVariant, workoutTitle, data.mission.durationMinutes, shareId]
  );

  // Record the share once. Fire-and-forget with a single retry, because the
  // card is useful whether or not the row lands — the link only needs to
  // resolve later, and a failed insert must never block the share sheet.
  useEffect(() => {
    let cancelled = false;
    async function record(attempt = 0): Promise<void> {
      const { error } = await callRpc('create_mission_share', {
        p_id: shareId,
        p_mission_id: data.mission.id,
        p_participant_id: participantId ?? null,
        p_kind: 'card',
        p_layout: layout,
        p_variant: effectiveVariant,
        p_claim_token: claimToken ?? null,
        p_host_token: hostToken ?? null,
      });
      if (error && attempt === 0 && !cancelled) {
        await record(1);
      }
    }
    void record();
    return () => {
      cancelled = true;
    };
    // Deliberately once per panel, not per ratio: see shareIdRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleShare = useCallback(async () => {
    const blob = blobRef.current.get(`${layout}:${effectiveVariant}`);
    if (!blob) {
      return;
    }
    setBusy(true);
    // Already rendered, so navigator.share is still inside the click. Awaiting
    // a render here would make iOS reject the sheet.
    const file = new File([blob], cardFileName(shareId, layout), { type: 'image/png' });
    const result = await shareArtifact({ file, caption, shareId, kind: 'card', layout });
    setBusy(false);
    if (result.outcome === 'downloaded') {
      setNotice('Saved. Caption copied — paste it when you post.');
    }
  }, [layout, effectiveVariant, shareId, caption]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setNotice('Caption and link copied.');
    } catch {
      setNotice(`Copy this: ${shareUrl(shareId)}`);
    }
  }, [caption, shareId]);

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

      {notice ? <p className="text-xs text-secondary">{notice}</p> : null}
    </section>
  );
}
