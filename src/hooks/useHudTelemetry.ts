import { useEffect, useState } from 'react';
import { fetchHudTelemetry } from '@/lib/api/hudTelemetry';
import type { HUDTelemetryPayload } from '@/lib/hud/types';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

export function useHudTelemetry() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [telemetry, setTelemetry] = useState<HUDTelemetryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchHudTelemetry()
      .then((result) => {
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
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Something went wrong. Please try again.');
        setTelemetry(null);
      })
      .finally(() => {
        if (!cancelled) {
          setHasLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, user]);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

  return {
    telemetry,
    error,
    loading,
    isAuthenticated,
    isAuthLoading,
  };
}
