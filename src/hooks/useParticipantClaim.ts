import { useEffect, useMemo, useState } from 'react';
import {
  claimParticipant,
  fetchParticipantClaimStatus,
} from '@/lib/api/claimParticipant';
import type { ClaimStatus } from '@/lib/claim/resolveClaimStatus';
import { shouldShowClaimPrompt } from '@/lib/claim/shouldShowClaimPrompt';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  clearStoredClaimToken,
  getStoredClaimToken,
  getStoredParticipantId,
} from '@/lib/sessionIdentity';

export function useParticipantClaim(sessionId: string) {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const participantId = getStoredParticipantId(sessionId);
  const claimToken = getStoredClaimToken(sessionId);

  const [claimStatusFromServer, setClaimStatusFromServer] =
    useState<ClaimStatus>('unknown');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !participantId || !user) {
      return;
    }

    let cancelled = false;

    fetchParticipantClaimStatus(participantId).then((result) => {
      if (!cancelled) {
        if (result.data?.ok === true) {
          setClaimStatusFromServer(result.data.status);
        } else {
          setClaimStatusFromServer('unknown');
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, participantId, user?.id]);

  const claimStatus: ClaimStatus = useMemo(() => {
    if (isAuthLoading || !isAuthenticated || !user) {
      return 'unknown';
    }
    return claimStatusFromServer;
  }, [isAuthLoading, isAuthenticated, user, claimStatusFromServer]);

  const showClaimPrompt = shouldShowClaimPrompt({
    isAuthenticated,
    claimToken,
    participantId,
    claimStatus,
  });

  async function saveToAccount() {
    if (!participantId || !claimToken) {
      return;
    }

    setIsClaiming(true);
    setClaimError(null);
    setClaimMessage(null);

    const result = await claimParticipant({
      participantId,
      claimToken,
    });

    setIsClaiming(false);

    if (result.error) {
      setClaimError(result.error.message);
      return;
    }

    if (result.data?.ok === false) {
      if (result.data.reason === 'already_claimed') {
        setClaimError('This session was already saved to another account.');
      } else if (result.data.reason === 'invalid_claim_token') {
        setClaimError('Save link expired. Rejoin from this device if you still have access.');
      } else {
        setClaimError(`Could not save session: ${result.data.reason}`);
      }
      return;
    }

    if (result.data?.ok === true) {
      clearStoredClaimToken(sessionId);
      setClaimStatusFromServer('claimed');
      setClaimMessage(
        result.data.alreadyClaimed
          ? 'This session is already on your account.'
          : 'Session saved to your account.'
      );
    }
  }

  return {
    showClaimPrompt,
    claimStatus,
    isClaiming,
    claimMessage,
    claimError,
    saveToAccount,
  };
}
