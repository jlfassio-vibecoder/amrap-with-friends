import { buildGoogleCalendarUrl, type CalendarEventInput } from '@/lib/calendar/buildCalendarEvent';
import { downloadIcs } from '@/lib/calendar/downloadIcs';

/**
 * The two ways to save an event, in one place.
 *
 * The download and the Google link were written inline on the featured-WOD
 * card. A room needed the same pair, and a second copy of a blob download is
 * how one of them quietly keeps a bug the other fixed -- the deferred revoke
 * below being exactly the sort of detail that does not get copied twice.
 */
export function AddToCalendar({
  event,
  fileName,
  onSaved,
}: {
  event: CalendarEventInput;
  fileName: string;
  /** Called with the method actually used, for whatever the caller tracks. */
  onSaved?: (method: 'ics' | 'google') => void;
}) {
  return (
    <p className="flex flex-wrap gap-3 text-xs">
      <button
        type="button"
        className="link-accent"
        onClick={() => {
          downloadIcs(event, fileName);
          onSaved?.('ics');
        }}
      >
        Download calendar invite
      </button>
      <a
        className="link-accent"
        href={buildGoogleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        onClick={() => onSaved?.('google')}
      >
        Add to Google Calendar
      </a>
    </p>
  );
}
