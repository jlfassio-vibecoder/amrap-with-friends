import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { CoachDataTable } from '@/components/coach/CoachDataTable';
import { CoachEventsExplorer } from '@/components/coach/CoachEventsExplorer';
import { CoachFunnelCard } from '@/components/coach/CoachFunnelCard';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { fetchCoachDashboard, type CoachDashboard } from '@/lib/api/coach';
import { formatCoachLabel } from '@/lib/coach/formatCoachLabel';

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export default function CoachPage() {
  const [dashboard, setDashboard] = useState<CoachDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {loading ? <p className="text-sm text-secondary">Loading…</p> : null}
        {error ? <p className="text-error text-sm">{error}</p> : null}

        {dashboard ? (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Overview</h2>
              <CoachStatGrid
                stats={[
                  { label: 'Sessions created (7d)', value: dashboard.topStrip.sessionsCreated7d },
                  { label: 'Sessions created (30d)', value: dashboard.topStrip.sessionsCreated30d },
                  { label: 'Sessions finished (7d)', value: dashboard.topStrip.sessionsFinished7d },
                  { label: 'Sessions finished (30d)', value: dashboard.topStrip.sessionsFinished30d },
                  { label: 'Unique visitors (anon)', value: dashboard.topStrip.uniqueAnonIds },
                  { label: 'Registered users', value: dashboard.topStrip.registeredUsers },
                  { label: 'Live sessions created', value: dashboard.topStrip.liveSessionsCreated },
                  { label: 'Practice sessions started', value: dashboard.topStrip.practiceSessionsStarted },
                ]}
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Where commitment dies</h2>
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
                  title="Intake dossier"
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
              <h2 className="text-lg font-semibold text-ink">
                Which workouts / flows to fix or promote
              </h2>
              <div className="card space-y-4 p-4">
                <CoachDataTable
                  rows={dashboard.templatePerformance}
                  rowKey={(row) => `${row.templateId}-${row.durationMinutes}-${row.intensityTier}`}
                  emptyLabel="No sessions with a template yet."
                  columns={[
                    { header: 'Template', render: (row) => formatCoachLabel(row.templateId) },
                    { header: 'Intensity', render: (row) => row.intensityTier ?? '—', align: 'right' },
                    { header: 'Duration', render: (row) => `${row.durationMinutes}m`, align: 'right' },
                    { header: 'Created', render: (row) => row.sessionsCreated, align: 'right' },
                    { header: 'Completed', render: (row) => row.sessionsCompleted, align: 'right' },
                    {
                      header: 'Completion %',
                      render: (row) => pct(row.completionRatePct),
                      align: 'right',
                    },
                  ]}
                />
                <p className="text-sm text-secondary">
                  Live-session abandonment:{' '}
                  <span className="font-semibold text-ink">
                    {pct(dashboard.sessionAbandonment.abandonmentRatePct)}
                  </span>{' '}
                  ({dashboard.sessionAbandonment.sessionsWithAbandonmentEvent} abandoned mid-work
                  vs. {dashboard.sessionAbandonment.sessionsFinished} finished)
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Build for hosts, joiners, or both</h2>
              <div className="card p-4">
                <CoachDataTable
                  rows={dashboard.hostVsJoinerRetention}
                  rowKey={(row) => row.firstRole}
                  emptyLabel="No registered users with session history yet."
                  columns={[
                    { header: 'First role', render: (row) => formatCoachLabel(row.firstRole) },
                    { header: 'Users', render: (row) => row.userCount, align: 'right' },
                    {
                      header: 'Avg. sessions / user',
                      render: (row) => row.avgSessionsPerUser ?? '—',
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
              <h2 className="text-lg font-semibold text-ink">
                Safari / PWA friction worth engineering time
              </h2>
              <div className="card p-4">
                <CoachDataTable
                  rows={dashboard.audioUnlockRate}
                  rowKey={(row) => row.audioContextState}
                  emptyLabel="No audio unlock attempts logged yet."
                  columns={[
                    { header: 'AudioContext state', render: (row) => formatCoachLabel(row.audioContextState) },
                    { header: 'Count', render: (row) => row.unlockCount, align: 'right' },
                    { header: '% of unlocks', render: (row) => pct(row.pctOfUnlocks), align: 'right' },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Dev reliability</h2>
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
                      { header: 'p50 ms', render: (row) => row.p50LatencyMs ?? '—', align: 'right' },
                      { header: 'p95 ms', render: (row) => row.p95LatencyMs ?? '—', align: 'right' },
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
              <h2 className="text-lg font-semibold text-ink">Explore</h2>
              <CoachEventsExplorer />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
