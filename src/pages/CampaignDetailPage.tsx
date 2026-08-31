import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { CampaignEditForm } from '@/components/campaign/CampaignEditForm';
import { CampaignScheduleSection } from '@/components/campaign/CampaignScheduleSection';
import { AddSquadFriendToCampaign } from '@/components/campaign/AddSquadFriendToCampaign';
import { CopyCampaignInvite } from '@/components/campaign/CopyCampaignInvite';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  deleteCampaign,
  endCampaign,
  fetchCampaignDetail,
  fetchCampaignStandings,
  leaveCampaign,
  rescheduleCampaignOccurrence,
  startCampaignMakeup,
  updateCampaign,
  type CampaignDetail,
  type CampaignStandingRow,
  type CampaignStandingsMember,
  type CampaignStandingsScore,
} from '@/lib/api/campaigns';
import {
  campaignMakeupQueue,
  campaignProgress,
  campaignRoleDescription,
  campaignRoleLabel,
  canDeleteCampaign,
  canEditCampaign,
  canEndCampaign,
  canRescheduleOccurrence,
  computeCampaignTestProgress,
  deriveCampaignRoles,
  formatCampaignRepDelta,
  formatCampaignRepScore,
  formatCampaignShape,
  formatOccurrenceDate,
  type CampaignOccurrenceRole,
  type CampaignTestProgress,
} from '@/lib/campaign';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  complete: 'Complete',
  abandoned: 'Ended early',
};

function formatNormalisedAverage(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAmrapAuth();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [standings, setStandings] = useState<CampaignStandingRow[]>([]);
  const [standingsMembers, setStandingsMembers] = useState<CampaignStandingsMember[]>([]);
  const [standingsScores, setStandingsScores] = useState<CampaignStandingsScore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmHostAction, setConfirmHostAction] = useState<'end' | 'delete' | null>(null);
  const [hostActionBusy, setHostActionBusy] = useState(false);
  // Kept apart from `error`, which blanks the whole page: a refused end or
  // delete should leave the campaign readable.
  const [hostActionError, setHostActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingDetails, setEditingDetails] = useState(false);
  const [makeupBusy, setMakeupBusy] = useState(false);
  const [makeupError, setMakeupError] = useState<string | null>(null);

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
  }, [campaignId, reloadKey]);

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

  async function handleSaveDetails(next: { name: string; goal: string }) {
    if (!campaignId) {
      return 'Something went wrong. Please try again.';
    }
    const result = await updateCampaign(campaignId, next);
    if (result.error) {
      return result.error.message;
    }
    setEditingDetails(false);
    setReloadKey((key) => key + 1);
    return null;
  }

  async function handleMove(occurrenceId: string, localDate: string, localTime: string) {
    const result = await rescheduleCampaignOccurrence(occurrenceId, localDate, localTime);
    if (result.error) {
      return result.error.message;
    }
    setReloadKey((key) => key + 1);
    return null;
  }

  async function handleEnd() {
    if (!campaignId) {
      return;
    }
    setHostActionBusy(true);
    const result = await endCampaign(campaignId);
    setHostActionBusy(false);
    setConfirmHostAction(null);
    if (result.error) {
      setHostActionError(result.error.message);
      return;
    }
    // Stay put and reload: seeing the campaign marked "Ended early" is better
    // confirmation than being dropped back on the home page.
    setHostActionError(null);
    setReloadKey((key) => key + 1);
  }

  async function handleDelete() {
    if (!campaignId) {
      return;
    }
    setHostActionBusy(true);
    const result = await deleteCampaign(campaignId);
    setHostActionBusy(false);
    if (result.error) {
      setConfirmHostAction(null);
      setHostActionError(result.error.message);
      return;
    }
    navigate('/');
  }

  async function handleMakeUp(occurrenceId: string) {
    setMakeupBusy(true);
    setMakeupError(null);
    const result = await startCampaignMakeup(occurrenceId);
    setMakeupBusy(false);
    if (result.error || !result.data) {
      setMakeupError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    navigate(`/mission/${result.data.missionId}`);
  }

  const progress = campaignProgress(
    detail.occurrences.filter((occurrence) => occurrence.status === 'done').length,
    detail.occurrences.length
  );

  // The role is read back out of the schedule rather than stored, so a
  // campaign created before this existed still labels its tests correctly.
  const roleBySequence = new Map<number, CampaignOccurrenceRole>();
  deriveCampaignRoles(detail.occurrences).forEach((role, index) => {
    roleBySequence.set(detail.occurrences[index].sequence, role);
  });
  const lifecycle = {
    viewerRole: detail.viewerRole,
    status: detail.status,
    occurrences: detail.occurrences.map((occurrence) => ({
      status: occurrence.status,
      missionId: occurrence.missionId,
    })),
    activeMemberCount: detail.members.length,
  };
  const showEnd = canEndCampaign(lifecycle);
  const showDelete = canDeleteCampaign(lifecycle);
  const showEdit = canEditCampaign(lifecycle);

  const hasCountableMissions = detail.occurrences.some(
    (occurrence) => occurrence.status === 'generated' || occurrence.status === 'done'
  );
  const hasMadeUpScores = standingsScores.some((score) => score.madeUp === true);
  const madeUpFootnote =
    'Made up means they scored it alone after missing the live mission with the crew. It still counts.';

  const testProgress: CampaignTestProgress | null = computeCampaignTestProgress({
    occurrences: detail.occurrences.map((occurrence) => ({
      occurrenceId: occurrence.occurrenceId,
      weekNumber: occurrence.weekNumber,
      templateId: occurrence.templateId,
      localDate: occurrence.localDate,
    })),
    members: standingsMembers,
    scores: standingsScores,
    campaignStatus: detail.status,
  });

  const viewerMember = detail.members.find((member) => member.userId === user?.id);
  const viewerJoinedLocalDate = viewerMember
    ? new Date(viewerMember.joinedAt).toLocaleDateString('en-CA', {
        timeZone: detail.timezone,
      })
    : null;
  const owedQueue =
    detail.status === 'active' && user?.id && viewerJoinedLocalDate
      ? campaignMakeupQueue({
          occurrences: detail.occurrences,
          viewerJoinedLocalDate,
          viewerUserId: user.id,
          scores: standingsScores,
          makeups: detail.makeups,
        })
      : [];
  const owedHead = owedQueue[0] ?? null;
  const headRole = owedHead
    ? roleBySequence.get(
        detail.occurrences.find((row) => row.occurrenceId === owedHead.occurrenceId)?.sequence ?? -1
      )
    : null;

  return (
    <NarrowPageLayout
      title={detail.name}
      subtitle={formatCampaignShape(detail.weekCount, detail.missionsPerWeek)}
      contentMaxWidthClassName="max-w-3xl"
    >
      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary">
            {STATUS_LABEL[detail.status] ?? detail.status}
          </span>
          <span className="text-sm text-secondary">
            {progress.done} of {progress.total} missions done
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

        {editingDetails ? (
          <CampaignEditForm
            name={detail.name}
            goal={detail.goal ?? ''}
            onSave={handleSaveDetails}
            onCancel={() => setEditingDetails(false)}
          />
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            {detail.goal ? (
              <p className="text-sm text-secondary">{detail.goal}</p>
            ) : (
              <p className="text-sm text-muted">No goal set.</p>
            )}
            {showEdit ? (
              <button
                type="button"
                className="text-sm font-semibold text-accent"
                onClick={() => setEditingDetails(true)}
              >
                Edit name and goal
              </button>
            ) : null}
          </div>
        )}
      </section>

      {owedQueue.length > 0 && owedHead ? (
        <section className="card space-y-4 p-6">
          <div>
            <h2 className="text-display text-xl text-ink">
              {owedQueue.length === 1
                ? 'You owe 1 mission'
                : `You owe ${owedQueue.length} missions`}
            </h2>
            <p className="text-sm text-secondary">
              Make them up oldest first. Live campaign missions stay open — this only settles what
              you missed.
            </p>
          </div>
          <p className="text-sm text-ink">
            Next up: {formatOccurrenceDate(owedHead.localDate)}
            {headRole && campaignRoleLabel(headRole) ? ` · ${campaignRoleLabel(headRole)}` : null}
          </p>
          {makeupError ? <p className="text-error text-sm">{makeupError}</p> : null}
          <button
            type="button"
            className="btn-primary"
            disabled={makeupBusy}
            onClick={() => void handleMakeUp(owedHead.occurrenceId)}
          >
            {makeupBusy ? 'Opening…' : 'Make this up'}
          </button>
        </section>
      ) : null}

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
                        {row.benchmarkMadeUp || row.retestMadeUp ? (
                          <span className="ml-2 text-xs uppercase tracking-widest text-muted">
                            Made up
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
              {hasMadeUpScores ? (
                <p className="mt-3 text-sm text-secondary">{madeUpFootnote}</p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="card space-y-4 p-6">
        <h2 className="text-display text-xl text-ink">Standings</h2>
        {!hasCountableMissions ? (
          <p className="text-sm text-secondary">
            Standings show up once the first campaign mission is generated.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-divider text-xs uppercase tracking-widest text-muted">
                  <th className="pb-2 pr-3 font-semibold">Rank</th>
                  <th className="pb-2 pr-3 font-semibold">Athlete</th>
                  <th className="pb-2 pr-3 font-semibold">Average</th>
                  <th className="pb-2 font-semibold">Missions attended</th>
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
                      {row.hasMadeUp ? (
                        <span className="ml-2 text-xs uppercase tracking-widest text-muted">
                          Made up
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
            {hasMadeUpScores ? (
              <p className="mt-3 text-sm text-secondary">{madeUpFootnote}</p>
            ) : null}
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

        {detail.viewerRole === 'host' &&
        detail.status !== 'complete' &&
        detail.status !== 'abandoned' ? (
          <AddSquadFriendToCampaign
            campaignId={detail.campaignId}
            memberUserIds={detail.members.map((member) => member.userId)}
            onAdded={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {showEnd || showDelete ? (
          <div className="space-y-3 border-t border-divider pt-4">
            {confirmHostAction === null ? (
              <div className="flex flex-wrap items-center gap-4">
                {showEnd ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent"
                    onClick={() => {
                      setHostActionError(null);
                      setConfirmHostAction('end');
                    }}
                  >
                    End campaign
                  </button>
                ) : null}
                {showDelete ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-secondary hover:text-ink"
                    onClick={() => {
                      setHostActionError(null);
                      setConfirmHostAction('delete');
                    }}
                  >
                    Delete campaign
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-secondary">
                  {confirmHostAction === 'delete'
                    ? 'Delete this campaign? Nothing has run yet, so there is nothing to keep. This cannot be undone.'
                    : 'End this campaign? The missions still to come are cancelled, everyone keeps the ones they finished, and you get the slot back to start something else.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={hostActionBusy}
                    onClick={() =>
                      void (confirmHostAction === 'delete' ? handleDelete() : handleEnd())
                    }
                  >
                    {hostActionBusy
                      ? 'Working…'
                      : confirmHostAction === 'delete'
                        ? 'Yes, delete it'
                        : 'Yes, end it'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={hostActionBusy}
                    onClick={() => setConfirmHostAction(null)}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
            {hostActionError ? <p className="alert-error">{hostActionError}</p> : null}
          </div>
        ) : null}

        {detail.viewerRole === 'member' ? (
          confirmLeave ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary">
                Leave this campaign? Your finished missions stay on your record, and the host can
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

      <CampaignScheduleSection
        occurrences={detail.occurrences}
        roleBySequence={roleBySequence}
        canMove={(occurrence) =>
          canRescheduleOccurrence(lifecycle, {
            status: occurrence.status,
            missionId: occurrence.missionId,
          })
        }
        onMove={handleMove}
      />

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
