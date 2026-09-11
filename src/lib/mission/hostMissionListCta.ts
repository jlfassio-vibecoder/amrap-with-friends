/**
 * Primary list CTA for a host opening `/mission/:id` from My missions
 * or scheduled-mission panels. Same destination; label names the job.
 */
export function hostMissionListCtaLabel(state: string): string {
  switch (state) {
    case 'waiting':
      return 'Start this mission';
    case 'setup':
    case 'work':
      return 'Enter mission';
    default:
      return 'View mission';
  }
}

/** My missions lists hosts and joiners — only hosts get the Start label. */
export function myMissionListCtaLabel(state: string, role: string): string {
  if (role === 'host') {
    return hostMissionListCtaLabel(state);
  }
  return state === 'finished' ? 'View mission' : 'Enter mission';
}
