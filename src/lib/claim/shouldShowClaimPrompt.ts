import type { ClaimStatus } from '@/lib/claim/resolveClaimStatus';

export function shouldShowClaimPrompt(input: {
  isAuthenticated: boolean;
  claimToken: string | null;
  participantId: string | null;
  claimStatus: ClaimStatus;
}): boolean {
  return (
    input.isAuthenticated &&
    input.claimToken !== null &&
    input.participantId !== null &&
    input.claimStatus === 'claimable'
  );
}
