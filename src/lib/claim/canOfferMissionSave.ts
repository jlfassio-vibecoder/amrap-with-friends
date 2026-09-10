import type { ClaimStatus } from '@/lib/claim/resolveClaimStatus';

export function canOfferMissionSave(input: {
  claimToken: string | null;
  participantId: string | null;
  claimStatus: ClaimStatus;
}): boolean {
  if (!input.claimToken || !input.participantId) {
    return false;
  }

  return input.claimStatus !== 'claimed' && input.claimStatus !== 'claimed_by_other';
}
