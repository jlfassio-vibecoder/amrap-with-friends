import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { CampaignRoleBadge } from '@/components/campaign/CampaignRoleBadge';
import { CopyCampaignInvite } from '@/components/campaign/CopyCampaignInvite';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import {
  fetchCampaignDetail,
  fetchCampaignStandings,
  leaveCampaign,
  type CampaignDetail,
  type CampaignStandingRow,
  type CampaignStandingsMember,
  type CampaignStandingsScore,
} from '@/lib/api/campaigns';
import {
  campaignProgress,
  campaignRoleDescription,
  computeCampaignTestProgress,
  deriveCampaignRoles,
  formatCampaignRepDelta,
  formatCampaignRepScore,
  formatCampaignShape,
  formatOccurrenceDate,
  groupOccurrencesByWeek,
  type CampaignOccurrenceRole,
  type CampaignTestProgress,
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

const WORKOUT_NAMES = new Map(WORKOUT_TEMPLATES.map((template) => [template.id, template.name]));

function formatNormalisedAverage(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [standings, setStandings] = useState<CampaignStandingRow[]>([]);
  const [standingsMembers, setStandingsMembers] = useState<CampaignStandingsMember[]>([]);
  const [standingsScores, setStandingsScores] = useState<CampaignStandingsScore[]>([]);
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
    Promise.all([fetchCampaignDetail(campaignId), fetchCampaignStandings(campaignId)])
      .then(([detailResult, standingsResult]) => {
        if (cancelled) {
          return;
        }
        if (detailResult.error || !detailResult.data) {
          setError(detailResult.error?.message ?? 'That campaign is not available.');
          setDetail(null);
          setStandings([]);
          setStandingsMembers([]);
          setStandingsScores([]);
        } else {
          setError(null);
          setDetail(detailResult.data);
          // Standings ACL mirrors detail; a soft failure leaves the rest of the page usable.
          if (standingsResult.error) {
            setStandings([]);
            setStandingsMembers([]);
            setStandingsScores([]);
          } else {
            setStandings(standingsResult.data.standings);
            setStandingsMembers(standingsResult.data.members);
            setStandingsScores(standingsResult.data.scores);
          }
        }
        setLoadedId(campaignId);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('That campaign is not available.');
        setDetail(null);
        setStandings([]);
        setStandingsMembers([]);
        setStandingsScores([]);
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

  // The role is read back out of the schedule rather than stored, so a
  // campaign created before this existed still labels its tests correctly.
  const roleBySequence = new Map<number, CampaignOccurrenceRole>();
  deriveCampaignRoles(detail.occurrences).forEach((role, index) => {
    roleBySequence.set(detail.occurrences[index].sequence, role);
  });
  const hasCountableSessions = detail.occurrences.some(
    (occurrence) => occurrence.status === 'generated' || occurrence.status === 'done'
  );

  const testProgress: CampaignTestProgress | null = computeCampaignTestProgress({
    occurrences: detail.occurrences.map((occurrence) => ({
      occurrenceId: occurrence.occurrenceId,
      weekNumber: occurrence.weekNumber,
      templateId: occurrence.templateId,
      localDate: occurrence.localDate,
    })),
    members: standingsMembers,
    scores: standingsScores,
  });

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

      {testProgress ? (
        <section className="card space-y-4 p-6">
          <div>
            <h2 className="text-display text-xl text-ink">The test</h2>
            <p className="text-sm text-secondary">{campaignRoleDescription('retest')}</p>
          </div>
          {!testProgress.hasBenchmarkScore ? (
            <p className="text-sm text-secondary">Scores show up after the opening benchmark.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-divider text-xs uppercase tracking-widest text-muted">
                    <th className="pb-2 pr-3 font-semibold">Athlete</th>
                    <th className="pb-2 pr-3 font-semibold">Week 1</th>
                    <th className="pb-2 pr-3 font-semibold">Latest retest</th>
                    <th className="pb-2 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {testProgress.rows.map((row) => (
                    <tr key={row.userId} className="border-b border-divider last:border-0">
                      <td className="py-2.5 pr-3 text-ink">
                        {row.nickname ?? 'Athlete'}
                        {row.left ? (
                          <span className="ml-2 text-xs uppercase tracking-widest text-muted">
                            Left
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink">
                        {formatCampaignRepScore(row.benchmarkScore)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink">
                        {formatCampaignRepScore(row.retestScore)}
                      </td>
                      <td className="py-2.5 tabular-nums text-ink">
                        {formatCampaignRepDelta(row.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="card space-y-4 p-6">
        <h2 className="text-display text-xl text-ink">Standings</h2>
        {!hasCountableSessions ? (
          <p className="text-sm text-secondary">
            Standings show up once the first campaign session is generated.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-divider text-xs uppercase tracking-widest text-muted">
                  <th className="pb-2 pr-3 font-semibold">Rank</th>
                  <th className="pb-2 pr-3 font-semibold">Athlete</th>
                  <th className="pb-2 pr-3 font-semibold">Average</th>
                  <th className="pb-2 font-semibold">Sessions attended</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.userId} className="border-b border-divider last:border-0">
                    <td className="py-2.5 pr-3 tabular-nums text-secondary">{row.rank}</td>
                    <td className="py-2.5 pr-3 text-ink">
                      {row.nickname ?? 'Athlete'}
                      {row.left ? (
                        <span className="ml-2 text-xs uppercase tracking-widest text-muted">
                          Left
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink">
                      {formatNormalisedAverage(row.normalisedAverage)}
                    </td>
                    <td className="py-2.5 tabular-nums text-secondary">
                      {row.attended} of {row.eligible}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <CopyCampaignInvite inviteCode={detail.inviteCode} campaignId={detail.campaignId} />
        ) : null}

        {detail.viewerRole === 'member' ? (
          confirmLeave ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary">
                Leave this campaign? Your finished sessions stay on your record, and the host can
                invite you back.
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
                  <span className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
                    {formatOccurrenceDate(occurrence.localDate)}
                    <span className="font-normal text-secondary">{occurrence.localTime}</span>
                    <CampaignRoleBadge role={roleBySequence.get(occurrence.sequence) ?? 'build'} />
                  </span>
                  <span className="flex items-baseline gap-3 text-sm text-secondary">
                    {occurrence.templateId ? (
                      <span>{WORKOUT_NAMES.get(occurrence.templateId) ?? 'Workout'}</span>
                    ) : null}
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
