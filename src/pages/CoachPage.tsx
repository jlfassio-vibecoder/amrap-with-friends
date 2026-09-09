import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CoachActivityCohorts } from '@/components/coach/CoachActivityCohorts';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachEventsExplorer } from '@/components/coach/CoachEventsExplorer';
import { CoachFunnelCard } from '@/components/coach/CoachFunnelCard';
import { CoachGuestBrowsersPanel } from '@/components/coach/CoachGuestBrowsersPanel';
import { CoachOnboardingStuckTable } from '@/components/coach/CoachOnboardingStuckTable';
import { CoachRetentionGrid } from '@/components/coach/CoachRetentionGrid';
import { CoachSectionHeader } from '@/components/coach/CoachSectionHeader';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { CoachUserDetailPanel } from '@/components/coach/CoachUserDetailPanel';
import { CoachUserPicker } from '@/components/coach/CoachUserPicker';
import { CoachWindowPicker } from '@/components/coach/CoachWindowPicker';
import {
  coachDashboardWindowLabel,
  fetchCoachDashboard,
  type CoachDashboard,
  type CoachDashboardWindow,
  type CoachUserListRow,
} from '@/lib/api/coach';
import { GUEST_BROWSERS_STAT_ID } from '@/lib/coach/guestBrowsersWindows';
import { formatCoachLabel } from '@/lib/coach/formatCoachLabel';
import {
  toolCohortLabel,
  toolLiftIsMeaningful,
  toolLiftVsReaders,
} from '@/lib/coach/toolConversion';
import {
  dropoffHeadline,
  socialLift,
  socialLiftIsMeaningful,
} from '@/lib/coach/engagementInsights';
import { useOnlineAnonIds } from '@/hooks/useOnlineUserIds';

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export default function CoachPage() {
  const [dashboard, setDashboard] = useState<CoachDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CoachUserListRow | null>(null);
  const [guestBrowsersOpen, setGuestBrowsersOpen] = useState(false);
  const [reportWindow, setReportWindow] = useState<CoachDashboardWindow>('all');
  const onlineAnonIds = useOnlineAnonIds();

  useEffect(() => {
    let cancelled = false;
    fetchCoachDashboard(reportWindow).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setDashboard(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [reportWindow]);

  // Reset in the handler rather than in the effect: a synchronous setState
  // inside an effect body triggers a cascading render.
  function handleWindowChange(next: CoachDashboardWindow) {
    setLoading(true);
    setError(null);
    setReportWindow(next);
  }

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="Coach" subtitle="Product analytics" />

      <div className="mx-auto max-w-6xl space-y-8 px-6 pb-10 pt-0 lg:px-8 lg:py-10">
        <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">WOD Builder</h2>
            <p className="text-sm text-secondary">
              Create custom exercises and coach-authored workouts.
            </p>
          </div>
          <Link
            className="btn-primary inline-flex shrink-0 items-center justify-center text-sm"
            to="/coach/wods"
          >
            Open WOD Builder
          </Link>
        </section>

        <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink">Article Builder</h2>
            <p className="text-sm text-secondary">
              Draft blog posts with copy and photos for the SEO content layer.
            </p>
          </div>
          <Link
            className="btn-primary inline-flex shrink-0 items-center justify-center text-sm"
            to="/coach/articles"
          >
            Open Article Builder
          </Link>
        </section>

        <CoachActivityCohorts selectedUser={selectedUser} onSelect={setSelectedUser} />
        <CoachOnboardingStuckTable />
        <CoachUserPicker selectedUser={selectedUser} onSelect={setSelectedUser} />

        {selectedUser ? (
          <CoachUserDetailPanel key={selectedUser.userId} userId={selectedUser.userId} />
        ) : null}

        {!selectedUser && loading ? <p className="text-sm text-secondary">Loading…</p> : null}
        {!selectedUser && error ? <p className="text-error text-sm">{error}</p> : null}

        {!selectedUser && dashboard ? (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CoachSectionHeader title="Overview" />
                <CoachWindowPicker
                  value={reportWindow}
                  onChange={handleWindowChange}
                  disabled={loading}
                />
              </div>
              <CoachStatGrid
                selectedId={guestBrowsersOpen ? GUEST_BROWSERS_STAT_ID : null}
                onSelect={(id) => setGuestBrowsersOpen(id === GUEST_BROWSERS_STAT_ID)}
                stats={[
                  { label: 'Missions created (7d)', value: dashboard.topStrip.missionsCreated7d },
                  { label: 'Missions created (30d)', value: dashboard.topStrip.missionsCreated30d },
                  { label: 'Missions finished (7d)', value: dashboard.topStrip.missionsFinished7d },
                  {
                    label: 'Missions finished (30d)',
                    value: dashboard.topStrip.missionsFinished30d,
                  },
                  {
                    id: GUEST_BROWSERS_STAT_ID,
                    selectable: true,
                    label: 'Guest browsers (7d)',
                    value: dashboard.topStrip.guestBrowsers7d,
                  },
                  { label: 'Anonymous now', value: onlineAnonIds.size },
                  { label: 'Registered users', value: dashboard.topStrip.registeredUsers },
                  { label: 'Live missions created', value: dashboard.topStrip.liveMissionsCreated },
                  {
                    label: 'Practice missions started',
                    value: dashboard.topStrip.practiceMissionsStarted,
                  },
                ]}
              />
              <p className="text-xs text-secondary">
                These tiles name their own window and do not follow the picker; every section below
                does.
              </p>
              {guestBrowsersOpen ? (
                <CoachGuestBrowsersPanel onDismiss={() => setGuestBrowsersOpen(false)} />
              ) : null}
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Where commitment dies · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CoachFunnelCard
                  title="Guest → account (claim)"
                  steps={[
                    { label: 'Prompt shown', value: dashboard.claimFunnel.promptsShown },
                    { label: 'Completed', value: dashboard.claimFunnel.claimsCompleted },
                    { label: 'Conflict', value: dashboard.claimFunnel.claimsConflicted },
                  ]}
                  ratePct={dashboard.claimFunnel.completionRatePct}
                  rateLabel="Completion rate"
                />
                <CoachFunnelCard
                  title="Incomplete sign-ups"
                  steps={[
                    { label: 'Submitted', value: dashboard.intakeFunnel.submitted },
                    { label: 'Abandoned', value: dashboard.intakeFunnel.abandoned },
                  ]}
                  ratePct={dashboard.intakeFunnel.completionRatePct}
                  rateLabel="Completion rate"
                />
                <CoachFunnelCard
                  title="Rally link"
                  steps={[
                    { label: 'Links copied', value: dashboard.rallyConversion.linksCopied },
                    { label: 'Deep-link joins', value: dashboard.rallyConversion.deepLinkJoins },
                  ]}
                  ratePct={dashboard.rallyConversion.conversionRatePct}
                  rateLabel="Conversion rate"
                />
                {dashboard.signupFunnel.map((row) => (
                  <CoachFunnelCard
                    key={row.method}
                    title={`Sign-up (${formatCoachLabel(row.method)})`}
                    steps={[
                      { label: 'Attempted', value: row.attempts },
                      { label: 'Completed', value: row.completions },
                      { label: 'Awaiting email', value: row.awaitingConfirmation },
                      { label: 'Failed', value: row.failures },
                    ]}
                    ratePct={row.completionRatePct}
                    rateLabel="Completion rate"
                  />
                ))}
              </div>
              <div className="card space-y-2 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                  Why sign-in and sign-up fail
                </h3>
                <CoachDataTable
                  rows={dashboard.authFailureReasons}
                  rowKey={(row) => `${row.stage}-${row.reason}`}
                  emptyLabel="No auth failures logged yet."
                  columns={[
                    { header: 'Stage', render: (row) => formatCoachLabel(row.stage) },
                    { header: 'Reason', render: (row) => formatCoachLabel(row.reason) },
                    { header: 'Count', render: (row) => row.failureCount, align: 'right' },
                    {
                      header: '% of failures',
                      render: (row) => pct(row.pctOfFailures),
                      align: 'right',
                    },
                  ]}
                />
                <p className="text-xs text-secondary">
                  Google sign-up completions are not observable — the OAuth redirect leaves the app,
                  and the sign-in that comes back carries no link to the attempt that started it.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Do campaigns get finished · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <CoachFunnelCard
                  title="Concluded campaigns"
                  steps={[
                    { label: 'Concluded', value: dashboard.campaignFunnel.campaignsConcluded },
                    { label: 'Started', value: dashboard.campaignFunnel.campaignsStarted },
                    { label: 'Halfway', value: dashboard.campaignFunnel.campaignsReachedHalfway },
                    {
                      label: 'All missions done',
                      value: dashboard.campaignFunnel.campaignsFinished,
                    },
                  ]}
                  ratePct={dashboard.campaignFunnel.finishRatePct}
                  rateLabel="Finish rate"
                />
                <div className="card space-y-2 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                    By campaign length
                  </h3>
                  <CoachDataTable
                    rows={dashboard.campaignLengthAdherence}
                    rowKey={(row) => String(row.weekCount)}
                    emptyLabel="No campaigns have concluded yet."
                    columns={[
                      { header: 'Length', render: (row) => `${row.weekCount} weeks` },
                      { header: 'Campaigns', render: (row) => row.campaigns, align: 'right' },
                      {
                        header: 'Finished',
                        render: (row) => row.campaignsFinished,
                        align: 'right',
                      },
                      {
                        header: 'Missions done %',
                        render: (row) => pct(row.occurrenceAdherencePct),
                        align: 'right',
                      },
                    ]}
                  />
                </div>
              </div>
              <p className="text-sm text-secondary">
                {dashboard.campaignFunnel.campaignsInFlight} of{' '}
                {dashboard.campaignFunnel.campaignsCreated} campaigns are still in flight and are
                left out of the funnel — a campaign in week two has not failed to finish. Missions
                actually done across concluded campaigns:{' '}
                <span className="font-semibold text-ink">
                  {pct(dashboard.campaignFunnel.occurrenceAdherencePct)}
                </span>
                .
              </p>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Where athletes come from · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-3 p-4">
                <CoachDataTable
                  rows={dashboard.acquisition}
                  rowKey={(row) => `${row.channel}-${row.source}-${row.campaign}`}
                  emptyLabel="No first-touch data yet — capture starts with the next deploy."
                  columns={[
                    { header: 'Channel', render: (row) => formatCoachLabel(row.channel) },
                    { header: 'Source', render: (row) => row.source },
                    { header: 'Campaign', render: (row) => row.campaign },
                    { header: 'Browsers', render: (row) => row.browsers, align: 'right' },
                    { header: 'Signed up', render: (row) => row.signedUp, align: 'right' },
                    {
                      header: 'Sign-up %',
                      render: (row) => pct(row.signupRatePct),
                      align: 'right',
                    },
                    {
                      header: 'Completed a mission',
                      render: (row) => row.completed,
                      align: 'right',
                    },
                    {
                      header: 'Browser → completed %',
                      render: (row) => pct(row.completionRatePct),
                      align: 'right',
                    },
                  ]}
                />
                <p className="text-xs text-secondary">
                  First touch, ranked by athletes who completed a mission rather than by traffic — a
                  channel sending a thousand bounces is worth less than one sending ten people who
                  train. Clicks from our own content pages count as internal, not as a referral, so
                  the site cannot take credit for its own traffic. Only browsers seen since this
                  shipped appear here.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Do the free tools convert · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-3 p-4">
                <CoachDataTable
                  rows={dashboard.toolConversion}
                  rowKey={(row) => row.cohort}
                  emptyLabel="No tool activity yet — capture starts with the next deploy."
                  columns={[
                    { header: 'Visitor did', render: (row) => toolCohortLabel(row.cohort) },
                    { header: 'Browsers', render: (row) => row.browsers, align: 'right' },
                    { header: 'Clicked through', render: (row) => row.ctaClicks, align: 'right' },
                    { header: 'Signed up', render: (row) => row.signedUp, align: 'right' },
                    {
                      header: 'Sign-up %',
                      render: (row) => pct(row.signupRatePct),
                      align: 'right',
                    },
                    {
                      header: 'Completed a mission',
                      render: (row) => row.completedMission,
                      align: 'right',
                    },
                    {
                      header: 'Browser → completed %',
                      render: (row) => pct(row.completedRatePct),
                      align: 'right',
                    },
                  ]}
                />
                {toolLiftIsMeaningful(dashboard.toolConversion, 'timer_completed') ? (
                  <p className="text-sm text-secondary">
                    Finishing a free timer run is worth{' '}
                    <span className="font-semibold text-ink">
                      {toolLiftVsReaders(
                        dashboard.toolConversion,
                        'timer_completed',
                        'signupRatePct'
                      )}{' '}
                      points
                    </span>{' '}
                    on sign-up against readers who never touched a tool. If that is near zero the
                    timer is a detour, not a funnel.
                  </p>
                ) : (
                  <p className="text-sm text-secondary">
                    Not enough visitors in both groups yet — the lift is only reported once readers
                    and tool users each clear 20 browsers.
                  </p>
                )}
                <p className="text-xs text-secondary">
                  Cohorts overlap except "read only": someone who finished a run and also scored
                  their splits is counted in both, because each row answers "of the browsers who did
                  this, how many went on to train". Visitors who declined consent have no identifier
                  and are excluded here; their pageviews still count above.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Do the content pages convert · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-3 p-4">
                <CoachDataTable
                  rows={dashboard.contentPerformance}
                  rowKey={(row) => row.path}
                  emptyLabel="No content pageviews yet — capture starts with the next deploy."
                  scrollAfterRows={12}
                  columns={[
                    { header: 'Page', render: (row) => row.path },
                    { header: 'Visitors', render: (row) => row.visitors, align: 'right' },
                    { header: 'Landed here', render: (row) => row.entryViews, align: 'right' },
                    { header: 'Entered the app', render: (row) => row.ctaClicks, align: 'right' },
                    {
                      header: 'Crossed %',
                      render: (row) => pct(row.ctaRatePct),
                      align: 'right',
                    },
                    { header: 'Signed up', render: (row) => row.signedUp, align: 'right' },
                  ]}
                />
                <p className="text-xs text-secondary">
                  Ranked by people who crossed into the app, not by traffic — a page with ten
                  thousand readers who never enter is an SEO result, not a product one. "Landed
                  here" counts arrivals from outside the site, so it separates entry points from
                  pages people read second.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader title="Does anyone come back" />
              <div className="card space-y-3 p-4">
                <CoachRetentionGrid cells={dashboard.weeklyRetention} />
                <p className="text-xs text-secondary">
                  Cohorted on an athlete's first mission, not their sign-up date, and covering
                  registered users only — an anon id is per-browser, so guest retention would mostly
                  measure cookie lifetime. Not affected by the window picker: a cohort curve has to
                  look back further than the window to fill in.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Does training with friends work · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-3 p-4">
                <CoachDataTable
                  rows={dashboard.socialLift}
                  rowKey={(row) => row.cohort}
                  emptyLabel="No missions recorded in this window."
                  columns={[
                    { header: 'Trained', render: (row) => formatCoachLabel(row.cohort) },
                    { header: 'Missions', render: (row) => row.participations, align: 'right' },
                    { header: 'Athletes', render: (row) => row.athletes, align: 'right' },
                    {
                      header: 'Completed %',
                      render: (row) => pct(row.completionRatePct),
                      align: 'right',
                    },
                    {
                      header: 'Returned in 14d %',
                      render: (row) => pct(row.returnRatePct),
                      align: 'right',
                    },
                    {
                      header: 'Avg. group',
                      render: (row) => row.avgGroupSize ?? '—',
                      align: 'right',
                    },
                  ]}
                />
                {socialLiftIsMeaningful(dashboard.socialLift) ? (
                  <p className="text-sm text-secondary">
                    Training with someone else is worth{' '}
                    <span className="font-semibold text-ink">
                      {socialLift(dashboard.socialLift, 'completionRatePct').deltaPoints} points
                    </span>{' '}
                    on completion and{' '}
                    <span className="font-semibold text-ink">
                      {socialLift(dashboard.socialLift, 'returnRatePct').deltaPoints} points
                    </span>{' '}
                    on coming back within 14 days. A negative number here is the premise of the
                    product failing, and worth acting on.
                  </p>
                ) : (
                  <p className="text-sm text-secondary">
                    Not enough missions in both groups yet to compare — the lift is only reported
                    once solo and social each clear 20 missions.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Where inside a mission people quit · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-3 p-4">
                <CoachDataTable
                  rows={dashboard.missionDropoff}
                  rowKey={(row) => String(row.bucketOrder)}
                  emptyLabel="No abandonment beacons with a clock reading yet."
                  columns={[
                    { header: 'Quit during', render: (row) => row.elapsedBucket },
                    { header: 'Abandons', render: (row) => row.abandons, align: 'right' },
                    {
                      header: '% of abandons',
                      render: (row) => pct(row.pctOfAbandons),
                      align: 'right',
                    },
                    {
                      header: 'Median % elapsed',
                      render: (row) => pct(row.medianElapsedPct),
                      align: 'right',
                    },
                    {
                      header: 'Median rounds logged',
                      render: (row) => row.medianRounds ?? '—',
                      align: 'right',
                    },
                  ]}
                />
                {dropoffHeadline(dashboard.missionDropoff) ? (
                  <p className="text-sm text-secondary">
                    <span className="font-semibold text-ink">
                      {dropoffHeadline(dashboard.missionDropoff)}
                    </span>{' '}
                    Quitting early usually means the workout was wrong for the athlete; quitting
                    late usually means the clock or the Log round flow.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Which workouts / flows to fix or promote · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card space-y-4 p-4">
                <CoachDataTable
                  rows={dashboard.templatePerformance}
                  rowKey={(row) => `${row.templateId}-${row.durationMinutes}-${row.intensityTier}`}
                  emptyLabel="No missions with a template yet."
                  columns={[
                    { header: 'Template', render: (row) => formatCoachLabel(row.templateId) },
                    {
                      header: 'Intensity',
                      render: (row) => row.intensityTier ?? '—',
                      align: 'right',
                    },
                    {
                      header: 'Duration',
                      render: (row) => `${row.durationMinutes}m`,
                      align: 'right',
                    },
                    { header: 'Created', render: (row) => row.missionsCreated, align: 'right' },
                    { header: 'Completed', render: (row) => row.missionsCompleted, align: 'right' },
                    {
                      header: 'Completion %',
                      render: (row) => pct(row.completionRatePct),
                      align: 'right',
                    },
                  ]}
                />
                <p className="text-sm text-secondary">
                  Live-mission abandonment:{' '}
                  <span className="font-semibold text-ink">
                    {pct(dashboard.missionAbandonment.abandonmentRatePct)}
                  </span>{' '}
                  ({dashboard.missionAbandonment.missionsWithAbandonmentEvent} abandoned mid-work
                  vs. {dashboard.missionAbandonment.missionsFinished} finished)
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Build for hosts, joiners, or both · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card p-4">
                <CoachDataTable
                  rows={dashboard.hostVsJoinerRetention}
                  rowKey={(row) => row.firstRole}
                  emptyLabel="No registered users with mission history yet."
                  columns={[
                    { header: 'First role', render: (row) => formatCoachLabel(row.firstRole) },
                    { header: 'Users', render: (row) => row.userCount, align: 'right' },
                    {
                      header: 'Avg. missions / user',
                      render: (row) => row.avgMissionsPerUser ?? '—',
                      align: 'right',
                    },
                    {
                      header: 'Avg. active days / user',
                      render: (row) => row.avgActiveDaysPerUser ?? '—',
                      align: 'right',
                    },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Safari / PWA friction worth engineering time · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="card p-4">
                <CoachDataTable
                  rows={dashboard.audioUnlockRate}
                  rowKey={(row) => row.audioContextState}
                  emptyLabel="No audio unlock attempts logged yet."
                  columns={[
                    {
                      header: 'AudioContext state',
                      render: (row) => formatCoachLabel(row.audioContextState),
                    },
                    { header: 'Count', render: (row) => row.unlockCount, align: 'right' },
                    {
                      header: '% of unlocks',
                      render: (row) => pct(row.pctOfUnlocks),
                      align: 'right',
                    },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader
                title={`Dev reliability · ${coachDashboardWindowLabel(dashboard.window)}`}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card space-y-2 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                    RPC calls
                  </h3>
                  <CoachDataTable
                    rows={dashboard.rpcReliability}
                    rowKey={(row) => row.rpcName}
                    emptyLabel="No RPC calls logged yet."
                    columns={[
                      { header: 'RPC', render: (row) => formatCoachLabel(row.rpcName) },
                      { header: 'Calls', render: (row) => row.callCount, align: 'right' },
                      { header: 'Errors', render: (row) => row.errorCount, align: 'right' },
                      { header: 'Error %', render: (row) => pct(row.errorRatePct), align: 'right' },
                      {
                        header: 'p50 ms',
                        render: (row) => row.p50LatencyMs ?? '—',
                        align: 'right',
                      },
                      {
                        header: 'p95 ms',
                        render: (row) => row.p95LatencyMs ?? '—',
                        align: 'right',
                      },
                    ]}
                  />
                </div>
                <div className="card space-y-2 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                    Realtime channel
                  </h3>
                  <CoachDataTable
                    rows={dashboard.realtimeReliability}
                    rowKey={(row) => row.status}
                    emptyLabel="No realtime status events logged yet."
                    columns={[
                      { header: 'Status', render: (row) => formatCoachLabel(row.status) },
                      { header: 'Count', render: (row) => row.eventCount, align: 'right' },
                      {
                        header: 'p50 subscribe ms',
                        render: (row) => row.p50SubscribeLatencyMs ?? '—',
                        align: 'right',
                      },
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader title="Explore" />
              <CoachEventsExplorer />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
