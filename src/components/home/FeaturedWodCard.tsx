import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchCurrentFeaturedWod,
  type FeaturedWod,
} from '@/lib/api/featuredWod';
import { getFeaturedWodCardPresentation } from '@/lib/session/featuredWodCardPresentation';
import { track } from '@/lib/analytics/track';
import { buildGoogleCalendarUrl, buildIcsFileContent } from '@/lib/calendar/buildCalendarEvent';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

function calendarEventInputFor(featured: FeaturedWod) {
  const joinLine = featured.sessionId
    ? `Join: ${window.location.origin}/join?s=${featured.sessionId}`
    : null;
  return {
    // Once the session is generated the UID switches from the workout+time
    // to the session id — a distinct occurrence either way, so this isn't a
    // duplicate-vs-original conflict, just a different calendar entry.
    uid: featured.sessionId ?? `${featured.workoutName}-${featured.scheduledAt}`,
    title: `Featured WOD: ${featured.workoutName}`,
    description: [featured.focus, joinLine].filter(Boolean).join('\n'),
    startsAt: new Date(featured.scheduledAt),
    durationMinutes: featured.durationMinutes,
  };
}

function downloadIcsFile(featured: FeaturedWod) {
  const ics = buildIcsFileContent(calendarEventInputFor(featured));
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'featured-wod.ics';
  link.click();
  URL.revokeObjectURL(url);
}

/** How often to re-poll while mounted, so the waiting -> live transition and
 * attendee count actually update without a page reload. There's no
 * real-time channel for this (unlike an active AMRAP session), so a plain
 * interval is the proportionate choice for a landing-page preview card. */
const POLL_INTERVAL_MS = 20_000;

export function FeaturedWodCard() {
  const [featured, setFeatured] = useState<FeaturedWod | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // undefined = "haven't tracked a view yet", distinct from a legitimate
  // null sessionId (a not-yet-generated next occurrence).
  const trackedSessionRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      fetchCurrentFeaturedWod().then((result) => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        if (result.error) {
          return;
        }
        setFeatured(result.data);
        setNowMs(Date.now());

        // Track a view once per distinct joinable session, not on every
        // poll tick — a session going from "next occurrence" to an actual
        // joinable one counts as a new view, a plain attendee-count refresh
        // does not.
        const trackingKey = result.data?.sessionId ?? null;
        if (result.data && trackingKey !== trackedSessionRef.current) {
          trackedSessionRef.current = trackingKey;
          track('featured_wod_viewed', {
            joinable: result.data.sessionId !== null,
            state: result.data.state,
          });
        }
      });
    }

    poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Tick once a second while a generated session exists so setup→work→ended
  // copy updates between 20s RPC polls.
  useEffect(() => {
    if (!featured?.sessionId) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [featured?.sessionId]);

  if (loading || !featured) {
    return null;
  }

  const presentation = getFeaturedWodCardPresentation(featured, nowMs);

  return (
    <div className="card space-y-2 border-2 border-accent bg-accent-tint/40 p-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Featured WOD</p>
      <p className="text-display text-lg text-ink">{featured.workoutName}</p>
      {featured.focus ? <p className="text-sm text-secondary">{featured.focus}</p> : null}
      <p className="text-sm text-secondary">
        {featured.durationMinutes}m ·{' '}
        {INTENSITY_LABEL[featured.intensityTier] ?? featured.intensityTier}
        {featured.tags.length > 0 ? ` · ${featured.tags.join(', ')}` : ''}
      </p>
      <p className="text-sm font-semibold text-ink">{presentation.statusLine}</p>
      <p className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          className="link-accent"
          onClick={() => {
            downloadIcsFile(featured);
            track(
              'featured_wod_calendar_saved',
              { method: 'ics' },
              { sessionId: featured.sessionId }
            );
          }}
        >
          Download calendar invite
        </button>
        <a
          className="link-accent"
          href={buildGoogleCalendarUrl(calendarEventInputFor(featured))}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            track(
              'featured_wod_calendar_saved',
              { method: 'google' },
              { sessionId: featured.sessionId }
            )
          }
        >
          Add to Google Calendar
        </a>
      </p>
      {presentation.showJoinLobby ? (
        <Link
          className="btn-primary inline-block"
          to={`/join?s=${featured.sessionId}`}
          onClick={() =>
            track(
              'featured_wod_joined',
              { state: featured.state },
              { sessionId: featured.sessionId }
            )
          }
        >
          Join lobby
        </Link>
      ) : featured.sessionId ? null : (
        <p className="text-xs text-secondary">Lobby opens shortly before start.</p>
      )}
    </div>
  );
}
