import type { FeaturedWod } from '@/lib/api/featuredWod';
import { formatFeaturedWodTime } from '@/lib/api/featuredWod';

/** Matches the historic scheduler lead window: rally point join opens 15 minutes before start. */
export const FEATURED_WOD_RALLY_POINT_LEAD_MS = 15 * 60 * 1000;

export type FeaturedWodCardPhase = 'preview' | 'rallyPoint' | 'work' | 'finished';

export interface FeaturedWodCardPresentation {
  phase: FeaturedWodCardPhase;
  /** Primary status line under the schedule metadata. */
  statusLine: string;
  showJoinRallyPoint: boolean;
  /** True when the CTA should be the "Rally point opens shortly before start." hint. */
  showRallyPointOpensSoon: boolean;
}

/**
 * Maps Featured WOD RPC state to landing-card copy/CTA.
 * Lock strings use product-specified casing.
 * Workout lock copy follows DB/RPC state from host Start — not scheduled_at.
 */
export function getFeaturedWodCardPresentation(
  featured: FeaturedWod,
  nowMs: number = Date.now()
): FeaturedWodCardPresentation {
  const scheduledLabel = formatFeaturedWodTime(featured.scheduledAt);
  const attendeeSuffix =
    featured.attendeeCount !== null ? ` · ${featured.attendeeCount} joining` : '';

  if (!featured.missionId) {
    return {
      phase: 'preview',
      statusLine: scheduledLabel,
      showJoinRallyPoint: false,
      showRallyPointOpensSoon: true,
    };
  }

  const phase = resolveCardPhase(featured);

  if (phase === 'work') {
    return {
      phase,
      statusLine: 'Mission locked, amrap in progress.',
      showJoinRallyPoint: false,
      showRallyPointOpensSoon: false,
    };
  }

  if (phase === 'finished') {
    return {
      phase,
      statusLine: 'Mission locked, AMRAP ended.',
      showJoinRallyPoint: false,
      showRallyPointOpensSoon: false,
    };
  }

  const scheduledAtMs = Date.parse(featured.scheduledAt);
  const withinRallyPointLead =
    Number.isFinite(scheduledAtMs) && nowMs >= scheduledAtMs - FEATURED_WOD_RALLY_POINT_LEAD_MS;

  return {
    phase: 'rallyPoint',
    statusLine: `${scheduledLabel}${attendeeSuffix}`,
    showJoinRallyPoint: withinRallyPointLead,
    showRallyPointOpensSoon: !withinRallyPointLead,
  };
}

function resolveCardPhase(featured: FeaturedWod): FeaturedWodCardPhase {
  if (featured.state === 'finished') {
    return 'finished';
  }

  if (featured.state === 'work' || featured.state === 'setup') {
    return 'work';
  }

  return 'rallyPoint';
}
