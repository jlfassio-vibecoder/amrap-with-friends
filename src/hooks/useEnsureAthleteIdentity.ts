import { createElement, useCallback, useRef, useState, type ReactNode } from 'react';
import { IdentityOverlay } from '@/components/onboarding/IdentityOverlay';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { profileNeedsIntake } from '@/lib/auth/profileNeedsIntake';
import type { AthleteIdentityInput } from '@/lib/api/athleteProfile';

type PendingAction = () => void;

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
      if (profileNeedsIntake(profile, missing)) {
        pendingRef.current = action;
        setOpen(true);
        return;
      }
      action();
    },
    [profile, missing]
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
      pending?.();
      return { error: null };
    },
    [saveIdentity]
  );

  const handleClose = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const overlay: ReactNode = open
    ? createElement(IdentityOverlay, {
        acceptLabel: options?.acceptLabel ?? 'Accept & Launch',
        dismissible: options?.dismissible ?? true,
        onClose: handleClose,
        onAccept: handleAccept,
      })
    : null;

  return {
    ensureThen,
    overlay,
    needsIdentity,
    profileLoading: loading,
    open,
  };
}
