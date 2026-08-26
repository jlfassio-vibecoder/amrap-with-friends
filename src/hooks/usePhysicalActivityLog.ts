import { useCallback, useEffect, useState } from 'react';
import {
  deletePhysicalActivity,
  fetchPhysicalActivityList,
  logPhysicalActivity,
  type LogPhysicalActivityInput,
  type PhysicalActivityEntry,
} from '@/lib/api/physicalActivity';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { track } from '@/lib/analytics/track';

const LIST_LIMIT = 50;

export function usePhysicalActivityLog() {
  const { isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [entries, setEntries] = useState<PhysicalActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;
    fetchPhysicalActivityList(LIST_LIMIT)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error) {
          setError(result.error.message);
          setEntries([]);
          return;
        }
        setError(null);
        setEntries(result.data ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Something went wrong. Please try again.');
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHasLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated]);

  const logEntry = useCallback(async (input: LogPhysicalActivityInput) => {
    setSubmitting(true);
    const result = await logPhysicalActivity(input);
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return { error: result.error.message };
    }

    setError(null);
    setEntries((current) => [result.data!, ...current]);
    track('physical_activity_logged', {
      activity_type: input.activityType,
      duration_minutes: input.durationMinutes,
      intensity_tier: input.intensityTier,
    });
    return { error: null };
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    const previous = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));

    const result = await deletePhysicalActivity(id);
    if (result.error) {
      setEntries(previous);
      setError(result.error.message);
      return { error: result.error.message };
    }
    setError(null);
    return { error: null };
  }, [entries]);

  const loading = isAuthLoading || (isAuthenticated && !hasLoaded);

  return {
    entries: isAuthenticated ? entries : [],
    error: isAuthenticated ? error : null,
    loading,
    submitting,
    isAuthenticated,
    isAuthLoading,
    logEntry,
    removeEntry,
  };
}
