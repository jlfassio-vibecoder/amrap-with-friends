import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { track } from '@/lib/analytics/track';
import { callRpc } from '@/lib/api/callRpc';
import { shareImageUrl } from '@/lib/share/uploadShareImage';
import { shareOgTitle, type ShareSummary } from '@/lib/share/shareOg';

/**
 * Where a share link lands a human.
 *
 * Shows the card image and an invitation, and nothing else. The squad board is
 * deliberately absent: the picture was already posted to social media by the
 * person it belongs to, but the other athletes on that mission did not agree
 * to appear in an API for anyone holding a URL.
 */
export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [summary, setSummary] = useState<ShareSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!shareId) {
      return;
    }
    let cancelled = false;
    void callRpc('get_share_summary', { p_share_id: shareId }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoaded(true);
      const raw = result.data as Record<string, unknown> | null;
      if (raw?.ok === true) {
        setSummary({
          shareId: String(raw.shareId ?? shareId),
          imagePath: typeof raw.imagePath === 'string' ? raw.imagePath : null,
          templateId: typeof raw.templateId === 'string' ? raw.templateId : null,
          durationMinutes: Number(raw.durationMinutes ?? 0),
          rounds: Number(raw.rounds ?? 0),
          reps: Number(raw.reps ?? 0),
        });
      }
      track('share_link_viewed', { share_id: shareId, found: raw?.ok === true });
    });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
  const image =
    summary?.imagePath && supabaseUrl ? shareImageUrl(supabaseUrl, summary.imagePath) : null;

  return (
    <NarrowPageLayout
      title={summary ? shareOgTitle(summary) : 'A shared mission'}
      subtitle="Someone trained and left this behind."
    >
      <div className="space-y-6">
        {image ? (
          <img
            src={image}
            alt="Their mission result"
            className="mx-auto w-full max-w-sm rounded-card border border-border"
          />
        ) : null}

        {loaded && !summary ? (
          <p className="text-sm text-secondary">
            That link has expired or never existed. You can still start a mission of your own.
          </p>
        ) : null}

        <div className="space-y-3">
          <AppLink
            className="btn-primary inline-flex w-full items-center justify-center text-sm"
            to="/create"
            onClick={() => track('share_link_joined', { share_id: shareId ?? null })}
          >
            Start your own mission
          </AppLink>
          <AppLink className="link-accent block text-center text-sm" to="/">
            What is AMRAP With Friends?
          </AppLink>
        </div>
      </div>
    </NarrowPageLayout>
  );
}
