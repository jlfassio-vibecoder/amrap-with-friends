import { useCallback, useEffect, useState } from 'react';
import {
  fetchAthleteProfile,
  upsertAthleteProfile,
  type AthleteProfile,
} from '@/lib/api/athleteProfile';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

export function useAthleteProfile() {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return;
    }

    let cancelled = false;
    fetchAthleteProfile()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.error) {
          setError(result.error.message);
          setProfile(null);
          setMissing(false);
        } else {
          setProfile(result.data);
          setMissing(result.missing);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Something went wrong. Please try again.');
          setProfile(null);
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
  }, [isAuthLoading, isAuthenticated, user]);

  const save = useCallback(async (input: AthleteProfile) => {
    const result = await upsertAthleteProfile(input);
    if (result.error) {
      return { error: result.error.message };
    }
    setProfile(result.data);
    setMissing(false);
    setError(null);
    return { error: null };
  }, []);

  const loading = isAuthLoading || (isAuthenticated && user !== null && !hasLoaded);

  return {
    profile: isAuthenticated ? profile : null,
    missing: isAuthenticated ? missing : false,
    error: isAuthenticated ? error : null,
    loading,
    isAuthenticated,
    isAuthLoading,
    save,
  };
}
