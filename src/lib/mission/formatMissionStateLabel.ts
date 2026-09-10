/**
 * Athlete-facing label for `missions.state` / live phase.
 * DB keeps `work`; UI must say Live (CLAUDE vocabulary table).
 */
export function formatMissionStateLabel(state: string): string {
  switch (state) {
    case 'waiting':
      return 'Waiting';
    case 'setup':
      return 'Get ready';
    case 'work':
      return 'Live';
    case 'finished':
      return 'Finished';
    default:
      return state;
  }
}
