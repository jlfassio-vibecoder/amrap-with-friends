import { useEffect, useState } from 'react';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { fetchCoachIdentityJourney, type CoachIdentityJourney } from '@/lib/api/coach';
import { formatCoachLabel, truncateAnonId } from '@/lib/coach/formatCoachLabel';
import {
  groupJourneyByDay,
  journeyEntryIdentity,
  journeyEntryLabel,
  journeyStage,
  journeyStageLabel,
  unfinishedMissionCount,
} from '@/lib/coach/journeyTimeline';

interface CoachJourneyPanelProps {
  userId?: string | null;
  anonId?: string | null;
}

function formatDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, { timeZone: 'UTC', dateStyle: 'medium' });
}

function formatTime(at: string): string {
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function CoachJourneyPanel({ userId, anonId }: CoachJourneyPanelProps) {
  const [journey, setJourney] = useState<CoachIdentityJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoachIdentityJourney({ userId, anonId }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setJourney(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, anonId]);

  if (loading) {
    return <p className="text-sm text-secondary">Loading journey…</p>;
  }
  if (error) {
    return <p className="text-error text-sm">{error}</p>;
  }
  if (!journey) {
    return null;
  }

  const { identity, lifetime } = journey;
  const stage = journeyStage(lifetime);
  const unfinished = unfinishedMissionCount(lifetime);
  const days = groupJourneyByDay(journey.timeline);

  return (
    <section className="card space-y-4 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          Lifetime journey
        </h3>
        <p className="text-lg font-semibold text-ink">{journeyStageLabel(stage)}</p>
        <p className="text-xs text-secondary">
          {identity.anonIds.length > 0
            ? `${identity.anonIds.length} browser ${
                identity.anonIds.length === 1 ? 'identity' : 'identities'
              }: ${identity.anonIds.map(truncateAnonId).join(', ')}`
            : 'No guest history recorded.'}
          {identity.signedUpAt ? ' · signed up during this history' : ''}
        </p>
      </div>

      <CoachStatGrid
        stats={[
          { label: 'Missions joined', value: lifetime.missionsTotal },
          { label: 'Completed (scored)', value: lifetime.missionsCompleted },
          { label: 'Started, no score', value: unfinished },
          { label: 'Hosted', value: lifetime.missionsHosted },
          { label: 'Active days', value: lifetime.activeDays },
          { label: 'Workout minutes', value: lifetime.totalWorkoutMinutes },
          { label: 'Best score', value: lifetime.bestScore ?? 0 },
        ]}
      />

      {lifetime.missionsTotal > 0 && lifetime.missionsCompleted === 0 ? (
        <p className="text-sm text-secondary">
          Took part in {lifetime.missionsTotal}{' '}
          {lifetime.missionsTotal === 1 ? 'mission' : 'missions'} and never produced a score — the
          mission can finish without this athlete logging anything.
        </p>
      ) : null}

      <div className="space-y-3">
        {days.length === 0 ? <p className="text-sm text-secondary">No activity recorded.</p> : null}
        {days.map((group) => (
          <div key={group.day} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {formatDay(group.day)}
            </p>
            <ul className="space-y-1">
              {group.entries.map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-sm"
                >
                  <span className="tabular-nums text-secondary">{formatTime(entry.at)}</span>
                  <span
                    className={
                      entry.kind === 'mission' ? 'font-semibold text-ink' : 'text-secondary'
                    }
                  >
                    {journeyEntryLabel(entry)}
                  </span>
                  {journeyEntryIdentity(entry) === 'guest' ? (
                    <span className="text-xs uppercase tracking-wide text-secondary">guest</span>
                  ) : null}
                  {entry.kind === 'event' && entry.payload.route ? (
                    <span className="text-xs text-secondary">{entry.payload.route}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {Object.keys(journey.eventCounts).length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-secondary">Lifetime event counts</summary>
          <ul className="mt-2 space-y-1">
            {Object.entries(journey.eventCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <li key={name} className="flex justify-between gap-4">
                  <span className="text-secondary">{formatCoachLabel(name)}</span>
                  <span className="tabular-nums text-ink">{count}</span>
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
