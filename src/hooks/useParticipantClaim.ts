import { useEffect, useMemo, useRef, useState } from 'react';
import { claimParticipant, fetchParticipantClaimStatus } from '@/lib/api/claimParticipant';
import type { ClaimStatus } from '@/lib/claim/resolveClaimStatus';
import { shouldShowClaimPrompt } from '@/lib/claim/shouldShowClaimPrompt';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  clearStoredClaimToken,
  getStoredClaimToken,
  getStoredParticipantId,
} from '@/lib/missionIdentity';
import { track } from '@/lib/analytics/track';

export function useParticipantClaim(missionId: string) {
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const userId = user?.id ?? null;
  const participantId = getStoredParticipantId(missionId);
  const claimToken = getStoredClaimToken(missionId);

  const [claimStatusFromServer, setClaimStatusFromServer] = useState<ClaimStatus>('unknown');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !participantId || !userId) {
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
  }, [isAuthLoading, isAuthenticated, participantId, userId]);

  const claimStatus: ClaimStatus = useMemo(() => {
    if (isAuthLoading || !isAuthenticated || !userId) {
      return 'unknown';
    }
    return claimStatusFromServer;
  }, [isAuthLoading, isAuthenticated, userId, claimStatusFromServer]);

  const showClaimPrompt = shouldShowClaimPrompt({
    isAuthenticated,
    claimToken,
    participantId,
    claimStatus,
  });

  const promptShownRef = useRef(false);
  useEffect(() => {
    if (showClaimPrompt && !promptShownRef.current) {
      promptShownRef.current = true;
      track('claim_prompt_shown', {}, { userId, missionId, participantId });
    }
  }, [showClaimPrompt, userId, missionId, participantId]);

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
        track(
          'claim_conflict',
          { reason: result.data.reason },
          { userId, missionId, participantId }
        );
        setClaimError('This mission was already saved to another account.');
      } else if (result.data.reason === 'invalid_claim_token') {
        setClaimError('Save link expired. Rejoin from this device if you still have access.');
      } else {
        setClaimError(`Could not save mission: ${result.data.reason}`);
      }
      return;
    }

    if (result.data?.ok === true) {
      clearStoredClaimToken(missionId);
      setClaimStatusFromServer('claimed');
      track(
        'claim_completed',
        { already_claimed: result.data.alreadyClaimed ?? false },
        { userId, missionId, participantId }
      );
      setClaimMessage(
        result.data.alreadyClaimed
          ? 'This mission is already on your account.'
          : 'Mission saved to your account.'
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
