import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { fetchSmartRecoveryHistory, type SmartRecoveryHistoryEntry } from '@/lib/api/smartRecovery';
import {
  computeRecoveryLocks,
  type TemplateRecoveryLock,
} from '@/lib/smartRecovery/computeRecoveryLocks';
import { buildTemplatePatternIndex } from '@/lib/smartRecovery/deriveTemplatePatterns';
import {
  readSmartRecoveryEnabled,
  writeSmartRecoveryEnabled,
} from '@/lib/smartRecovery/smartRecoveryPrefs';

type UseSmartRecoveryOptions = {
  active?: boolean;
};

export function useSmartRecovery(options: UseSmartRecoveryOptions = {}) {
  const active = options.active ?? true;
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [enabled, setEnabledState] = useState(() => readSmartRecoveryEnabled());
  const [completions, setCompletions] = useState<SmartRecoveryHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeSmartRecoveryEnabled(next);
  }, []);

  const shouldFetch = active && enabled && isAuthenticated && !isAuthLoading && user !== null;

  useEffect(() => {
    if (!shouldFetch) {
      return;
    }

    let cancelled = false;

    fetchSmartRecoveryHistory()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error) {
          setError(result.error.message);
          setCompletions(null);
        } else {
          setCompletions(result.data?.completions ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError('Something went wrong. Please try again.');
        setCompletions(null);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, user]);

  const patternIndex = useMemo(() => buildTemplatePatternIndex(WORKOUT_TEMPLATES), []);

  const locks = useMemo((): Map<string, TemplateRecoveryLock> => {
    if (!active || !enabled || !completions) {
      return new Map();
    }
    return computeRecoveryLocks(completions, WORKOUT_TEMPLATES, new Date(), patternIndex);
  }, [active, enabled, completions, patternIndex]);

  const loading = shouldFetch && completions === null && error === null;

  return {
    enabled,
    setEnabled,
    locks,
    loading,
    error,
    isAuthenticated,
  };
}
