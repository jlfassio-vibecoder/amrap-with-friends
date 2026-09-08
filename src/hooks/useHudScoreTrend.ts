import { useEffect, useState } from 'react';
import { fetchMyMissions } from '@/lib/api/myMissions';
import { buildScoreTrend, type ScoreTrendWeek } from '@/lib/hud/scoreTrend';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

/** Long enough to show a real trend, short enough that a light week still reads as one bar among many, not the whole chart. */
export const SCORE_TREND_WEEK_COUNT = 8;

export function useHudScoreTrend() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [weeks, setWeeks] = useState<ScoreTrendWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;

    fetchMyMissions()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error || !result.data) {
          setError(result.error?.message ?? 'Something went wrong. Please try again.');
          setWeeks(null);
        } else {
          setWeeks(buildScoreTrend(result.data, SCORE_TREND_WEEK_COUNT));
          setError(null);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Something went wrong. Please try again.');
        setWeeks(null);
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
    weeks,
    error,
    loading,
    isAuthenticated,
  };
}
