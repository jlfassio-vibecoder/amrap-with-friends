import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchCurrentFeaturedWod,
  formatFeaturedWodTime,
  type FeaturedWod,
} from '@/lib/api/featuredWod';
import { track } from '@/lib/analytics/track';

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Active Recovery',
  2: 'Foundational',
  3: 'Tactical',
  4: 'Crucible',
  5: 'Tier 1',
};

export function FeaturedWodCard() {
  const [featured, setFeatured] = useState<FeaturedWod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentFeaturedWod().then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (!result.error) {
        setFeatured(result.data);
        if (result.data) {
          track('featured_wod_viewed', {
            joinable: result.data.sessionId !== null,
            state: result.data.state,
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !featured) {
    return null;
  }

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
      <p className="text-sm font-semibold text-ink">
        {featured.state === 'work'
          ? 'Live now'
          : `${formatFeaturedWodTime(featured.scheduledAt)}`}
        {featured.attendeeCount !== null
          ? ` · ${featured.attendeeCount} joining`
          : ''}
      </p>
      {featured.sessionId ? (
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
          {featured.state === 'work' ? 'Join now' : 'Join lobby'}
        </Link>
      ) : (
        <p className="text-xs text-secondary">Lobby opens shortly before start.</p>
      )}
    </div>
  );
}
