import { buildIcsFileContent, type CalendarEventInput } from '@/lib/calendar/buildCalendarEvent';

/**
 * Hands the athlete a .ics file.
 *
 * Its own module rather than a helper beside the component: this is the one
 * piece of the calendar path that touches the DOM, and keeping it here means
 * a second surface that needs it cannot end up with a second copy of the
 * deferred revoke below -- without which some browsers cancel the download
 * before they have finished reading the blob.
 */
export function downloadIcs(event: CalendarEventInput, fileName: string): void {
  const blob = new Blob([buildIcsFileContent(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
