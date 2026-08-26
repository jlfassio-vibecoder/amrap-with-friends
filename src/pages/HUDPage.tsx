import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AttritionGrid } from '@/components/hud/AttritionGrid';
import { ClassificationBadge } from '@/components/hud/ClassificationBadge';
import { DailyTelemetry } from '@/components/hud/DailyTelemetry';
import { DomainMatrixChart } from '@/components/hud/DomainMatrixChart';
import { PhysicalActivityList } from '@/components/hud/PhysicalActivityList';
import { PhysicalActivityLogForm } from '@/components/hud/PhysicalActivityLogForm';
import { WeeklyBaselineBar } from '@/components/hud/WeeklyBaselineBar';
import { quotasFromProfile } from '@/lib/hud/classificationQuotas';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';
import { usePhysicalActivityLog } from '@/hooks/usePhysicalActivityLog';

export default function HUDPage() {
  const { telemetry, error, loading, isAuthenticated, isAuthLoading } =
    useHudTelemetry();
  const { profile, loading: profileLoading } = useAthleteProfile();
  const quotas = quotasFromProfile(profile);
  const showTelemetry =
    !loading && !profileLoading && isAuthenticated && telemetry;

  const activityLog = usePhysicalActivityLog();

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="HUD" subtitle="Operational telemetry" />

      <div className="mx-auto max-w-5xl space-y-8 px-6 pb-10 pt-6 lg:px-8 lg:py-10">
        <p className="text-sm text-secondary lg:hidden">
          Locked-session volume and pacing for the current local week.
        </p>

        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">HUD</h1>
          <p className="text-sm text-secondary">
            Locked-session volume and pacing for the current local week.
          </p>
        </div>

        {loading || profileLoading ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : null}

        {!isAuthLoading && !isAuthenticated ? (
          <p className="text-sm text-secondary">
            Sign in to view your HUD. Only sessions saved to your account with a locked
            score count.
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

            <div className="grid gap-4 lg:grid-cols-2">
              <DailyTelemetry lastLockedAt={telemetry.lastLockedAt} />
              <WeeklyBaselineBar
                weekMinutes={telemetry.weekMinutes}
                weekPviAverage={telemetry.weekPviAverage}
                weekEndsAt={telemetry.weekEndsAt}
                baselineMinutes={quotas.civilianMinutes}
              />
            </div>

            <AttritionGrid
              attrition={telemetry.attrition}
              weekEndsAt={telemetry.weekEndsAt}
            />
            <DomainMatrixChart domainMinutes30d={telemetry.domainMinutes30d} />
          </div>
        ) : null}

        {isAuthenticated ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Physical activity</h2>
            <p className="text-sm text-secondary">
              Outside training you log here does not count toward weekly
              classification minutes — verified rank stays locked-AMRAP-only.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <PhysicalActivityLogForm
                submitting={activityLog.submitting}
                onSubmit={activityLog.logEntry}
              />
              {activityLog.error ? (
                <p className="text-error text-sm">{activityLog.error}</p>
              ) : (
                <PhysicalActivityList
                  entries={activityLog.entries}
                  onDelete={(id) => {
                    void activityLog.removeEntry(id);
                  }}
                />
              )}
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
