import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { WeeklyBaselineBar } from '@/components/hud/WeeklyBaselineBar';
import { fetchHudTelemetry } from '@/lib/api/hudTelemetry';
import type { HUDTelemetryPayload } from '@/lib/hud/types';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

export default function HUDPage() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [telemetry, setTelemetry] = useState<HUDTelemetryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchHudTelemetry().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error.message);
        setTelemetry(null);
      } else {
        setTelemetry(result.data);
        setError(null);
      }
      setHasLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

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
        <WeeklyBaselineBar
          weekMinutes={telemetry.weekMinutes}
          weekPviAverage={telemetry.weekPviAverage}
          weekEndsAt={telemetry.weekEndsAt}
        />
      ) : null}

      <p className="text-center text-sm">
        <Link className="link-accent" to="/">
          Back home
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
