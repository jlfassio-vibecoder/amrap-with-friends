import { useCallback, useRef, useState } from 'react';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { profileNeedsIntake } from '@/lib/auth/profileNeedsIntake';
import type { AthleteIdentityInput } from '@/lib/api/athleteProfile';

type PendingAction = (accepted?: AthleteIdentityInput) => void;

export function useEnsureAthleteIdentity(options?: {
  acceptLabel?: string;
  dismissible?: boolean;
}) {
  const { profile, missing, loading, saveIdentity, isAuthenticated } = useAthleteProfile();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingAction | null>(null);

  const needsIdentity = isAuthenticated && !loading && profileNeedsIntake(profile, missing);

  const ensureThen = useCallback(
    (action: PendingAction) => {
      // Only open the overlay when authenticated and fully loaded; callers are
      // responsible for the auth gate when the user is signed out.
      if (isAuthenticated && !loading && needsIdentity) {
        pendingRef.current = action;
        setOpen(true);
        return;
      }
      action();
    },
    [isAuthenticated, loading, needsIdentity]
  );

  const handleAccept = useCallback(
    async (input: AthleteIdentityInput) => {
      const result = await saveIdentity(input);
      if (result.error) {
        return result;
      }
      setOpen(false);
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.(input);
      return { error: null };
    },
    [saveIdentity]
  );

  const handleClose = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  return {
    ensureThen,
    needsIdentity,
    profileLoading: loading,
    open,
    overlayProps: {
      acceptLabel: options?.acceptLabel ?? 'Accept & Launch',
      dismissible: options?.dismissible ?? true,
      onClose: handleClose,
      onAccept: handleAccept,
    },
  };
}
