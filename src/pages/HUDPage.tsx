import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ActivityAttributionCard } from '@/components/hud/ActivityAttributionCard';
import { AttritionGrid } from '@/components/hud/AttritionGrid';
import { ClassificationBadge } from '@/components/hud/ClassificationBadge';
import { DailyTelemetry } from '@/components/hud/DailyTelemetry';
import { DomainMatrixChart } from '@/components/hud/DomainMatrixChart';
import { InAppActivitySummaryCard } from '@/components/hud/InAppActivitySummaryCard';
import { OutsideActivitySummaryCard } from '@/components/hud/OutsideActivitySummaryCard';
import { OvertrainingWarningCard } from '@/components/hud/OvertrainingWarningCard';
import { PhysicalActivityList } from '@/components/hud/PhysicalActivityList';
import { PhysicalActivityLogForm } from '@/components/hud/PhysicalActivityLogForm';
import { WeeklyBaselineBar } from '@/components/hud/WeeklyBaselineBar';
import { summarizePhysicalActivityWindow } from '@/lib/hud/activityWindowSummary';
import { evaluateOvertrainingRisk } from '@/lib/hud/evaluateOvertrainingRisk';
import { quotasFromProfile } from '@/lib/hud/classificationQuotas';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';
import { usePhysicalActivityLog } from '@/hooks/usePhysicalActivityLog';

export default function HUDPage() {
  const { telemetry, error, loading, isAuthenticated, isAuthLoading } = useHudTelemetry();
  const { profile, loading: profileLoading } = useAthleteProfile();
  const quotas = quotasFromProfile(profile);
  const showTelemetry = !loading && !profileLoading && isAuthenticated && telemetry;

  const activityLog = usePhysicalActivityLog();
  const outsideSummary = summarizePhysicalActivityWindow(activityLog.entries);
  const overtrainingRisk = telemetry ? evaluateOvertrainingRisk(telemetry.overtraining) : null;
  const showOvertrainingWarning =
    overtrainingRisk !== null && overtrainingRisk.riskLevel !== 'normal';

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="HUD" subtitle="Operational telemetry" />

      <div className="mx-auto max-w-5xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        <p className="text-sm text-secondary lg:hidden">
          Locked-mission volume and pacing for the current local week.
        </p>

        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">HUD</h1>
          <p className="text-sm text-secondary">
            Locked-mission volume and pacing for the current local week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link
            className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            to="/create"
          >
            Create mission
          </Link>
          <Link
            className="rounded-card bg-accent px-6 py-3.5 font-semibold text-on-accent hover:bg-accent-hover"
            to="/squad"
          >
            Invite your squad →
          </Link>
          <Link
            className="border-b border-accent pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink hover:text-accent"
            to="/join"
          >
            Join a mission
          </Link>
        </div>

        {loading || profileLoading ? <p className="text-sm text-secondary">Loading…</p> : null}

        {!isAuthLoading && !isAuthenticated ? (
          <p className="text-sm text-secondary">
            Sign in to view your HUD. Only missions saved to your account with a locked score count.
          </p>
        ) : null}

        {error ? <p className="text-error">Error: {error}</p> : null}

        {showTelemetry ? (
          <div className="space-y-4">
            <ClassificationBadge
              classification={telemetry.classification}
              perceivedClassification={profile?.perceivedClassification ?? null}
              quotas={quotas}
            />

            {showOvertrainingWarning ? (
              <OvertrainingWarningCard overtraining={telemetry.overtraining} />
            ) : null}

            <InAppActivitySummaryCard activity7d={telemetry.activity7d} />
            <OutsideActivitySummaryCard entries={activityLog.entries} />
            <ActivityAttributionCard
              inAppMissions={telemetry.activity7d.missionCount}
              outsideMissions={outsideSummary.missionCount}
              inAppMinutes={telemetry.activity7d.minutes}
              outsideMinutes={outsideSummary.totalMinutes}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <DailyTelemetry lastLockedAt={telemetry.lastLockedAt} />
              <WeeklyBaselineBar
                weekMinutes={telemetry.weekMinutes}
                weekPviAverage={telemetry.weekPviAverage}
                weekEndsAt={telemetry.weekEndsAt}
                baselineMinutes={quotas.civilianMinutes}
              />
            </div>

            <AttritionGrid attrition={telemetry.attrition} weekEndsAt={telemetry.weekEndsAt} />
            <DomainMatrixChart domainMinutes30d={telemetry.domainMinutes30d} />
          </div>
        ) : null}

        {isAuthenticated ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Physical activity</h2>
            <p className="text-sm text-secondary">
              Outside training you log here does not count toward weekly classification minutes —
              verified rank stays locked-AMRAP-only.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <PhysicalActivityLogForm
                submitting={activityLog.submitting}
                onSubmit={activityLog.logEntry}
              />
              {activityLog.loading ? (
                <p className="text-sm text-secondary">Loading activity…</p>
              ) : (
                <PhysicalActivityList
                  entries={activityLog.entries}
                  onDelete={(id) => {
                    void activityLog.removeEntry(id);
                  }}
                />
              )}
              {activityLog.error ? <p className="text-error text-sm">{activityLog.error}</p> : null}
            </div>
          </section>
        ) : null}

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          {isAuthenticated ? (
            <Link className="link-accent" to="/intake?next=%2Fhud">
              Edit dossier
            </Link>
          ) : null}
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}
