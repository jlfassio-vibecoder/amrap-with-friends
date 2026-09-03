import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CoachActivityCohorts } from '@/components/coach/CoachActivityCohorts';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachEventsExplorer } from '@/components/coach/CoachEventsExplorer';
import { CoachFunnelCard } from '@/components/coach/CoachFunnelCard';
import { CoachOnboardingStuckTable } from '@/components/coach/CoachOnboardingStuckTable';
import { CoachSectionHeader } from '@/components/coach/CoachSectionHeader';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { CoachUserDetailPanel } from '@/components/coach/CoachUserDetailPanel';
import { CoachUserPicker } from '@/components/coach/CoachUserPicker';
import { fetchCoachDashboard, type CoachDashboard, type CoachUserListRow } from '@/lib/api/coach';
import { formatCoachLabel } from '@/lib/coach/formatCoachLabel';
import { useOnlineAnonIds } from '@/hooks/useOnlineUserIds';

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export default function CoachPage() {
  const [dashboard, setDashboard] = useState<CoachDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CoachUserListRow | null>(null);
  const onlineAnonIds = useOnlineAnonIds();

  useEffect(() => {
    let cancelled = false;
    fetchCoachDashboard().then((result) => {
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
  }, []);

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
              <CoachSectionHeader title="Overview" />
              <CoachStatGrid
                stats={[
                  { label: 'Missions created (7d)', value: dashboard.topStrip.missionsCreated7d },
                  { label: 'Missions created (30d)', value: dashboard.topStrip.missionsCreated30d },
                  { label: 'Missions finished (7d)', value: dashboard.topStrip.missionsFinished7d },
                  {
                    label: 'Missions finished (30d)',
                    value: dashboard.topStrip.missionsFinished30d,
                  },
                  { label: 'Unique visitors (anon)', value: dashboard.topStrip.uniqueAnonIds },
                  { label: 'Anonymous now', value: onlineAnonIds.size },
                  { label: 'Registered users', value: dashboard.topStrip.registeredUsers },
                  { label: 'Live missions created', value: dashboard.topStrip.liveMissionsCreated },
                  {
                    label: 'Practice missions started',
                    value: dashboard.topStrip.practiceMissionsStarted,
                  },
                ]}
              />
            </section>

            <section className="space-y-3">
              <CoachSectionHeader title="Where commitment dies" />
              <div className="grid gap-4 sm:grid-cols-3">
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
              </div>
            </section>

            <section className="space-y-3">
              <CoachSectionHeader title="Which workouts / flows to fix or promote" />
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
              <CoachSectionHeader title="Build for hosts, joiners, or both" />
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
              <CoachSectionHeader title="Safari / PWA friction worth engineering time" />
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
              <CoachSectionHeader title="Dev reliability" />
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
