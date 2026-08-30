import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyCampaigns, type CampaignSummary } from '@/lib/api/campaigns';
import { campaignProgress, formatCampaignShape } from '@/lib/campaign';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/**
 * A campaign that is over still belongs in the list — it is the host's record
 * of it — but it must not read as live. Only the finished states get a chip;
 * an "Active" badge on every row would label nothing.
 */
const CLOSED_STATUS_LABEL: Record<string, string> = {
  complete: 'Complete',
  abandoned: 'Ended early',
};

interface MyCampaignsPanelProps {
  /** When false, omit the header New campaign button (e.g. My Sessions already has page CTAs). */
  showCreateCta?: boolean;
}

/**
 * Account-gated campaign list. Used on Home and My Sessions. Renders nothing
 * for signed-out visitors — campaigns need an account, and a sign-in prompt
 * here would just be noise.
 */
export function MyCampaignsPanel({ showCreateCta = true }: MyCampaignsPanelProps) {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Starts true and is only ever cleared from the fetch callback: setting it
  // synchronously inside the effect would cascade an extra render on mount.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;
    fetchMyCampaigns()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error) {
          setError(result.error.message);
          setCampaigns([]);
        } else {
          setError(null);
          setCampaigns(result.data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Something went wrong. Please try again.');
        setCampaigns([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated]);

  if (isAuthLoading || !isAuthenticated) {
    return null;
  }

  return (
    <section className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-display text-xl text-ink">Your campaigns</h2>
          <p className="text-sm text-secondary">
            A shared plan your crew works through together, week by week.
          </p>
        </div>
        {showCreateCta ? (
          <Link className="btn-primary" to="/campaign/new">
            New campaign
          </Link>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-secondary">Loading campaigns…</p> : null}

      {!loading && error ? <p className="text-error text-sm">{error}</p> : null}

      {!loading && !error && campaigns.length === 0 ? (
        <p className="text-sm text-secondary">
          No campaigns yet. Pick a length, a few training days, and the styles you want to train.
        </p>
      ) : null}

      {!loading && !error && campaigns.length > 0 ? (
        <ul className="divide-y divide-divider">
          {campaigns.map((campaign) => {
            const progress = campaignProgress(campaign.completedSessions, campaign.totalSessions);
            return (
              <li key={campaign.campaignId} className="py-3 first:pt-0 last:pb-0">
                <Link
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                  to={`/campaign/${campaign.campaignId}`}
                >
                  <span className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
                    {campaign.name}
                    {CLOSED_STATUS_LABEL[campaign.status] ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest text-muted">
                        {CLOSED_STATUS_LABEL[campaign.status]}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-secondary">
                    {formatCampaignShape(campaign.weekCount, campaign.sessionsPerWeek)} ·{' '}
                    {progress.done}/{progress.total} done
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
