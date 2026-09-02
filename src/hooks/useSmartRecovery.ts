import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { fetchPublishedCoachWorkouts, type PublishedCoachWorkout } from '@/lib/api/coachWod';
import { fetchSmartRecoveryHistory, type SmartRecoveryHistoryEntry } from '@/lib/api/smartRecovery';
import {
  computeRecoveryLocks,
  recoveryLockTargetsFromCoachWorkouts,
  recoveryLockTargetsFromTemplates,
  type TemplateRecoveryLock,
} from '@/lib/smartRecovery/computeRecoveryLocks';
import { buildCoachWorkoutPatternIndex } from '@/lib/smartRecovery/deriveCoachWorkoutPatterns';
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
  const [coachWorkouts, setCoachWorkouts] = useState<PublishedCoachWorkout[] | null>(null);
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

    void Promise.all([fetchSmartRecoveryHistory(), fetchPublishedCoachWorkouts({})]).then(
      ([historyResult, coachResult]) => {
        if (cancelled) {
          return;
        }

        if (historyResult.error) {
          setError(historyResult.error.message);
          setCompletions(null);
        } else {
          setCompletions(historyResult.data?.completions ?? []);
          setError(null);
        }

        setCoachWorkouts(coachResult.error ? [] : (coachResult.data ?? []));
      },
      () => {
        if (cancelled) {
          return;
        }
        setError('Something went wrong. Please try again.');
        setCompletions(null);
        setCoachWorkouts([]);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, user]);

  const patternIndex = useMemo(() => {
    const index = buildTemplatePatternIndex(WORKOUT_TEMPLATES);
    if (!coachWorkouts) {
      return index;
    }
    for (const [id, patterns] of buildCoachWorkoutPatternIndex(coachWorkouts)) {
      index.set(id, patterns);
    }
    return index;
  }, [coachWorkouts]);

  const locks = useMemo((): Map<string, TemplateRecoveryLock> => {
    if (!active || !enabled || !completions || !coachWorkouts) {
      return new Map();
    }

    const targets = [
      ...recoveryLockTargetsFromTemplates(WORKOUT_TEMPLATES),
      ...recoveryLockTargetsFromCoachWorkouts(coachWorkouts),
    ];

    return computeRecoveryLocks(completions, targets, new Date(), patternIndex);
  }, [active, enabled, completions, coachWorkouts, patternIndex]);

  const loading = shouldFetch && (completions === null || coachWorkouts === null) && error === null;

  return {
    enabled,
    setEnabled,
    locks,
    loading,
    error,
    isAuthenticated,
    coachWorkouts,
  };
}
