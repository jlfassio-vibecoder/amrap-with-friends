export type ClaimStatus = 'unknown' | 'claimable' | 'claimed' | 'claimed_by_other';

export function resolveClaimStatus(
  participantUserId: string | null | undefined,
  authUserId: string | null
): ClaimStatus {
  if (!authUserId) {
    return 'unknown';
  }

  if (participantUserId === null || participantUserId === undefined) {
    return 'claimable';
  }

  if (participantUserId === authUserId) {
    return 'claimed';
  }

  return 'claimed_by_other';
}
