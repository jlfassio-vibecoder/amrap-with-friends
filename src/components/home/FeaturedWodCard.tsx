import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCurrentFeaturedWod, type FeaturedWod } from '@/lib/api/featuredWod';
import { getFeaturedWodCardPresentation } from '@/lib/mission/featuredWodCardPresentation';
import { track } from '@/lib/analytics/track';
import { buildGoogleCalendarUrl, buildIcsFileContent } from '@/lib/calendar/buildCalendarEvent';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { buildRallyInviteUrl } from '@/lib/mission/buildRallyInviteUrl';
import { ogCardFromSex } from '@/lib/share/ogCard';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

function calendarEventInputFor(featured: FeaturedWod, card: ReturnType<typeof ogCardFromSex>) {
  const joinLine = featured.missionId
    ? `Join: ${buildRallyInviteUrl(featured.missionId, window.location.origin, card)}`
    : null;
  return {
    // Once the mission is generated the UID switches from the workout+time
    // to the mission id — a distinct occurrence either way, so this isn't a
    // duplicate-vs-original conflict, just a different calendar entry.
    uid: featured.missionId ?? `${featured.workoutName}-${featured.scheduledAt}`,
    title: `Mission: ${featured.workoutName}`,
    description: [featured.focus, joinLine].filter(Boolean).join('\n'),
    startsAt: new Date(featured.scheduledAt),
    durationMinutes: featured.durationMinutes,
  };
}

function downloadIcsFile(featured: FeaturedWod, card: ReturnType<typeof ogCardFromSex>) {
  const ics = buildIcsFileContent(calendarEventInputFor(featured, card));
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'featured-wod.ics';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revoke so the browser can start reading the blob after click().
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** How often to re-poll while mounted, so the waiting -> live transition and
 * attendee count actually update without a page reload. There's no
 * real-time channel for this (unlike an active AMRAP mission), so a plain
 * interval is the proportionate choice for a landing-page preview card. */
const POLL_INTERVAL_MS = 20_000;

export function FeaturedWodCard() {
  const { profile } = useAthleteProfile();
  const ogCard = ogCardFromSex(profile?.biologicalSex);
  const [featured, setFeatured] = useState<FeaturedWod | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // undefined = "haven't tracked a view yet", distinct from a legitimate
  // null missionId (a not-yet-generated next occurrence).
  const trackedMissionRef = useRef<string | null | undefined>(undefined);

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

        // Track a view once per distinct joinable mission, not on every
        // poll tick — a mission going from "next occurrence" to an actual
        // joinable one counts as a new view, a plain attendee-count refresh
        // does not.
        const trackingKey = result.data?.missionId ?? null;
        if (result.data && trackingKey !== trackedMissionRef.current) {
          trackedMissionRef.current = trackingKey;
          track('featured_wod_viewed', {
            joinable: result.data.missionId !== null,
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

  // Tick once a second while a generated mission exists so setup→work→ended
  // copy updates between 20s RPC polls.
  useEffect(() => {
    if (!featured?.missionId) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [featured?.missionId]);

  if (loading || !featured) {
    return null;
  }

  const presentation = getFeaturedWodCardPresentation(featured, nowMs);

  return (
    <div className="card bg-accent-tint/40 space-y-2 border-2 border-accent p-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Today’s mission</p>
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
            downloadIcsFile(featured, ogCard);
            track(
              'featured_wod_calendar_saved',
              { method: 'ics' },
              { missionId: featured.missionId }
            );
          }}
        >
          Download calendar invite
        </button>
        <a
          className="link-accent"
          href={buildGoogleCalendarUrl(calendarEventInputFor(featured, ogCard))}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            track(
              'featured_wod_calendar_saved',
              { method: 'google' },
              { missionId: featured.missionId }
            )
          }
        >
          Add to Google Calendar
        </a>
      </p>
      {presentation.showJoinRallyPoint ? (
        <Link
          className="btn-primary inline-block"
          to={`/join?m=${featured.missionId}`}
          onClick={() =>
            track(
              'featured_wod_joined',
              { state: featured.state },
              { missionId: featured.missionId }
            )
          }
        >
          Join mission
        </Link>
      ) : presentation.showRallyPointOpensSoon ? (
        <p className="text-xs text-secondary">Rally point opens shortly before start.</p>
      ) : null}
    </div>
  );
}
