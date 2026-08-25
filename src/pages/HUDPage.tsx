import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { AttritionGrid } from '@/components/hud/AttritionGrid';
import { ClassificationBadge } from '@/components/hud/ClassificationBadge';
import { DailyTelemetry } from '@/components/hud/DailyTelemetry';
import { DomainMatrixChart } from '@/components/hud/DomainMatrixChart';
import { WeeklyBaselineBar } from '@/components/hud/WeeklyBaselineBar';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';

export default function HUDPage() {
  const { telemetry, error, loading, isAuthenticated, isAuthLoading } =
    useHudTelemetry();
  const { profile } = useAthleteProfile();

  return (
    <NarrowPageLayout title="HUD" subtitle="Operational telemetry">
      <p className="text-sm text-secondary lg:hidden">
        Locked-session volume and pacing for the current local week.
      </p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">HUD</h1>
        <p className="text-sm text-secondary">
          Locked-session volume and pacing for the current local week.
        </p>
      </div>

      {loading ? <p className="text-sm text-secondary">Loading…</p> : null}

      {!isAuthLoading && !isAuthenticated ? (
        <p className="text-sm text-secondary">
          Sign in to view your HUD. Only sessions saved to your account with a locked
          score count.
        </p>
      ) : null}

      {error ? <p className="text-error">Error: {error}</p> : null}

      {!loading && isAuthenticated && telemetry ? (
        <div className="space-y-4">
          <ClassificationBadge
            classification={telemetry.classification}
            perceivedClassification={profile?.perceivedClassification ?? null}
          />
          <DailyTelemetry lastLockedAt={telemetry.lastLockedAt} />
          <WeeklyBaselineBar
            weekMinutes={telemetry.weekMinutes}
            weekPviAverage={telemetry.weekPviAverage}
            weekEndsAt={telemetry.weekEndsAt}
          />
          <AttritionGrid
            attrition={telemetry.attrition}
            weekEndsAt={telemetry.weekEndsAt}
          />
          <DomainMatrixChart domainMinutes30d={telemetry.domainMinutes30d} />
        </div>
      ) : null}

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
