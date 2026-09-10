/**
 * Whether the live mission view should show Reset (replaces Pause on live work).
 * Featured missions are refused server-side; hide the control when known.
 */
export function shouldShowMissionReset(input: {
  isPractice: boolean;
  isHost: boolean;
  isFeatured: boolean;
  phase: 'waiting' | 'setup' | 'work' | 'finished';
}): boolean {
  if (input.isPractice) {
    return true;
  }
  if (!input.isHost || input.isFeatured) {
    return false;
  }
  return input.phase === 'waiting' || input.phase === 'setup' || input.phase === 'work';
}
