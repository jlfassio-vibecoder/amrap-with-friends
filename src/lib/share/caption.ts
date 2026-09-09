import { formatScore, type FrameBar } from '@/lib/share/timeline';
import { shareUrl } from '@/lib/share/shareId';

/**
 * The text that goes to the share sheet and the clipboard.
 *
 * Two lines on purpose: the first is what the athlete wants to say, the second
 * is the link. Someone pasting this into a Story caption can delete the second
 * line and the post still works — the link is on the card image too.
 */
export function buildCaption(input: {
  bar: FrameBar | null;
  workoutTitle: string;
  durationMinutes: number;
  shareId: string;
  squadSize: number;
}): string {
  const score = input.bar ? `${formatScore(input.bar)} · ` : '';
  const withSquad = input.squadSize > 1 ? ` · with ${input.squadSize - 1} others` : '';
  return [
    `${score}${input.durationMinutes} min AMRAP${withSquad}`,
    `Join the next mission: ${shareUrl(input.shareId)}`,
  ].join('\n');
}
