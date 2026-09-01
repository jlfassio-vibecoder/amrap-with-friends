/**
 * Parent path for ← Back when there is no same-origin history entry
 * (opened in a new tab, pasted URL, or referrer stripped).
 */
export function backFallbackFor(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  if (/^\/exercises\/[^/]+$/.test(path)) return '/exercises';
  if (/^\/amrap-workouts\/\d+-minute\/[^/]+$/.test(path)) {
    return path.replace(/\/[^/]+$/, '');
  }
  if (/^\/amrap-workouts\/(style\/[^/]+|\d+-minute)$/.test(path)) return '/amrap-workouts';
  if (path === '/exercises' || path === '/amrap-workouts') return '/';
  return '/';
}
