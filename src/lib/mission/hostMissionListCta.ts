/**
 * Primary list CTA for a host opening `/mission/:id` from My missions
 * or scheduled-mission panels. Same destination; label names the job.
 */
export function hostMissionListCtaLabel(state: string): string {
  switch (state) {
    case 'waiting':
    case 'setup':
      return 'Start this mission';
    case 'work':
      return 'Enter mission';
    default:
      return 'View mission';
  }
}
