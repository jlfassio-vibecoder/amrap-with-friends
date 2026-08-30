import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { CopyCampaignInvite } from '@/components/campaign/CopyCampaignInvite';
import {
  fetchCampaignDetail,
  leaveCampaign,
  type CampaignDetail,
} from '@/lib/api/campaigns';
import {
  campaignProgress,
  formatCampaignShape,
  formatOccurrenceDate,
  groupOccurrencesByWeek,
} from '@/lib/campaign';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  complete: 'Complete',
  abandoned: 'Ended early',
};

const OCCURRENCE_LABEL: Record<string, string> = {
  planned: 'Planned',
  generated: 'Staging area open',
  done: 'Done',
  skipped: 'Skipped',
};

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    // A missing id is a routing problem, not a load — it is rendered below
    // without the effect touching state.
    if (!campaignId) {
      return;
    }

    let cancelled = false;
    fetchCampaignDetail(campaignId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error || !result.data) {
          setError(result.error?.message ?? 'That campaign is not available.');
          setDetail(null);
        } else {
          setError(null);
          setDetail(result.data);
        }
        setLoadedId(campaignId);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('That campaign is not available.');
        setDetail(null);
        setLoadedId(campaignId);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Treat a mismatched loaded id as loading so a route change never flashes
  // the previous campaign while the next fetch is in flight.
  const loading = Boolean(campaignId) && loadedId !== campaignId;

  if (campaignId && loading) {
    return (
      <NarrowPageLayout title="Campaign" contentMaxWidthClassName="max-w-3xl">
        <p className="text-sm text-secondary">Loading campaign…</p>
      </NarrowPageLayout>
    );
  }

  if (error || !detail) {
    return (
      <NarrowPageLayout title="Campaign" contentMaxWidthClassName="max-w-3xl">
        <p className="text-error">{error ?? 'That campaign is not available.'}</p>
        <p className="text-center text-sm">
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  async function handleLeave() {
    if (!campaignId) {
      return;
    }
    setLeaving(true);
    const result = await leaveCampaign(campaignId);
    setLeaving(false);
    if (result.error) {
      setError(result.error.message);
      setConfirmLeave(false);
      return;
    }
    navigate('/');
  }

  const progress = campaignProgress(
    detail.occurrences.filter((occurrence) => occurrence.status === 'done').length,
    detail.occurrences.length
  );
  const weeks = groupOccurrencesByWeek(detail.occurrences);

  return (
    <NarrowPageLayout
      title={detail.name}
      subtitle={formatCampaignShape(detail.weekCount, detail.sessionsPerWeek)}
      contentMaxWidthClassName="max-w-3xl"
    >
      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary">
            {STATUS_LABEL[detail.status] ?? detail.status}
          </span>
          <span className="text-sm text-secondary">
            {progress.done} of {progress.total} sessions done
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Campaign progress"
        >
          <div className="h-full bg-accent" style={{ width: `${progress.percent}%` }} />
        </div>

        {detail.goal ? <p className="text-sm text-secondary">{detail.goal}</p> : null}
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-display text-xl text-ink">The crew</h2>
          <span className="text-xs text-muted">
            {detail.members.length === 1 ? '1 athlete' : `${detail.members.length} athletes`}
          </span>
        </div>

        <ul className="flex flex-wrap gap-2">
          {detail.members.map((member) => (
            <li
              key={member.userId}
              className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink"
            >
              {member.nickname ?? 'Athlete'}
              {member.role === 'host' ? (
                <span className="ml-2 text-xs uppercase tracking-widest text-accent">Host</span>
              ) : null}
            </li>
          ))}
        </ul>

        {detail.viewerRole === 'host' && detail.inviteCode ? (
          <CopyCampaignInvite
            inviteCode={detail.inviteCode}
            campaignId={detail.campaignId}
          />
        ) : null}

        {detail.viewerRole === 'member' ? (
          confirmLeave ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary">
                Leave this campaign? Your finished sessions stay on your record,
                and the host can invite you back.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={leaving}
                  onClick={() => void handleLeave()}
                >
                  {leaving ? 'Leaving…' : 'Yes, leave'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setConfirmLeave(false)}
                >
                  Stay
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm font-semibold text-accent"
              onClick={() => setConfirmLeave(true)}
            >
              Leave campaign
            </button>
          )
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-display text-xl text-ink">The schedule</h2>
        {weeks.map((week) => (
          <div key={week.weekNumber} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
              Week {week.weekNumber}
            </p>
            <ul className="divide-y divide-divider rounded-card border border-border bg-surface">
              {week.occurrences.map((occurrence) => (
                <li
                  key={occurrence.occurrenceId}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-ink">
                    {formatOccurrenceDate(occurrence.localDate)}
                    <span className="ml-2 font-normal text-secondary">
                      {occurrence.localTime}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-3 text-sm text-secondary">
                    <span>{occurrence.durationMinutes} min</span>
                    {occurrence.sessionId ? (
                      <Link className="link-accent" to={`/session/${occurrence.sessionId}`}>
                        {OCCURRENCE_LABEL[occurrence.status] ?? occurrence.status}
                      </Link>
                    ) : (
                      <span className="text-xs uppercase tracking-widest text-muted">
                        {OCCURRENCE_LABEL[occurrence.status] ?? occurrence.status}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
