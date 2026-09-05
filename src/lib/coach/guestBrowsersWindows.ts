export type GuestBrowsersWindow = '24h' | '3d' | '7d' | '30d' | '90d' | '365d';

export type GuestBrowsersGrain = 'hour' | 'day';

export interface GuestBrowsersWindowDefinition {
  id: GuestBrowsersWindow;
  label: string;
}

export const GUEST_BROWSERS_WINDOWS: GuestBrowsersWindowDefinition[] = [
  { id: '24h', label: 'Past 24 Hours' },
  { id: '3d', label: 'Past 3 Days' },
  { id: '7d', label: 'Past Week' },
  { id: '30d', label: 'Past Month' },
  { id: '90d', label: 'Past 3 Months' },
  { id: '365d', label: 'Past 12 Months' },
];

export const DEFAULT_GUEST_BROWSERS_WINDOW: GuestBrowsersWindow = '7d';

export const GUEST_BROWSERS_STAT_ID = 'guest-browsers';

export const GUEST_BROWSERS_CHART_METRIC = 'guest_browsers';

export function isGuestBrowsersWindow(value: string): value is GuestBrowsersWindow {
  return GUEST_BROWSERS_WINDOWS.some((window) => window.id === value);
}

export function guestBrowsersWindowLabel(window: GuestBrowsersWindow): string {
  return GUEST_BROWSERS_WINDOWS.find((row) => row.id === window)?.label ?? window;
}

export function formatGuestBrowsersBucket(iso: string, grain: GuestBrowsersGrain): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  if (grain === 'hour') {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function guestBrowsersCountLabel(count: number, grain: GuestBrowsersGrain): string {
  const noun = count === 1 ? 'guest' : 'guests';
  if (grain === 'hour') {
    return `${count.toLocaleString()} ${noun} this hour`;
  }
  return `${count.toLocaleString()} ${noun}`;
}

export function notesByBucketFromList(
  notes: { bucketStart: string; body: string }[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const note of notes) {
    map[note.bucketStart] = note.body;
  }
  return map;
}
