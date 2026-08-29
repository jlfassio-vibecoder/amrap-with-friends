import type { FeaturedWod } from '@/lib/api/featuredWod';
import { formatFeaturedWodTime } from '@/lib/api/featuredWod';

/** Matches the historic scheduler lead window: lobby join opens 15 minutes before start. */
export const FEATURED_WOD_LOBBY_LEAD_MS = 15 * 60 * 1000;

export type FeaturedWodCardPhase = 'preview' | 'lobby' | 'work' | 'finished';

export interface FeaturedWodCardPresentation {
  phase: FeaturedWodCardPhase;
  /** Primary status line under the schedule metadata. */
  statusLine: string;
  showJoinLobby: boolean;
  /** True when the CTA should be the "Staging area opens shortly before start." hint. */
  showLobbyOpensSoon: boolean;
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

  if (!featured.sessionId) {
    return {
      phase: 'preview',
      statusLine: scheduledLabel,
      showJoinLobby: false,
      showLobbyOpensSoon: true,
    };
  }

  const phase = resolveCardPhase(featured);

  if (phase === 'work') {
    return {
      phase,
      statusLine: 'Session locked, amrap in progress.',
      showJoinLobby: false,
      showLobbyOpensSoon: false,
    };
  }

  if (phase === 'finished') {
    return {
      phase,
      statusLine: 'Session locked, AMRAP ended.',
      showJoinLobby: false,
      showLobbyOpensSoon: false,
    };
  }

  const scheduledAtMs = Date.parse(featured.scheduledAt);
  const withinLobbyLead =
    Number.isFinite(scheduledAtMs) &&
    nowMs >= scheduledAtMs - FEATURED_WOD_LOBBY_LEAD_MS;

  return {
    phase: 'lobby',
    statusLine: `${scheduledLabel}${attendeeSuffix}`,
    showJoinLobby: withinLobbyLead,
    showLobbyOpensSoon: !withinLobbyLead,
  };
}

function resolveCardPhase(featured: FeaturedWod): FeaturedWodCardPhase {
  if (featured.state === 'finished') {
    return 'finished';
  }

  if (featured.state === 'work' || featured.state === 'setup') {
    return 'work';
  }

  return 'lobby';
}
