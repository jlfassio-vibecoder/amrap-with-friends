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
  if (/^\/guides\/[^/]+$/.test(path)) return '/guides';
  if (/^\/science\/[^/]+$/.test(path)) return '/science';
  if (/^\/blog\/category\/[^/]+$/.test(path)) return '/blog';
  if (/^\/blog\/[^/]+$/.test(path)) return '/blog';
  if (path === '/exercises' || path === '/amrap-workouts' || path === '/guides' || path === '/blog')
    return '/';
  return '/';
}
