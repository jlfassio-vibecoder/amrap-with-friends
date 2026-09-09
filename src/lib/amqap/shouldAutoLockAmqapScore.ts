/**
 * AMQAP finishes should lock a score without the metabolic PartialReps modal.
 * Quality flows still need score_breakdown for HUD volume / Active Recovery.
 */
export function shouldAutoLockAmqapScore(input: {
  isAmqap: boolean;
  isPractice: boolean;
  phase: string;
  hasSubmittedPartialReps: boolean;
  hasParticipant: boolean;
}): boolean {
  return (
    input.isAmqap &&
    !input.isPractice &&
    input.phase === 'finished' &&
    !input.hasSubmittedPartialReps &&
    input.hasParticipant
  );
}
