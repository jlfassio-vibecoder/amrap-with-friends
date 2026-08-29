import { computeFeaturedSessionClock } from '@/lib/session/featuredWodSessionClock';
import type { FeaturedWod } from '@/lib/api/featuredWod';
import { formatFeaturedWodTime } from '@/lib/api/featuredWod';

export type FeaturedWodCardPhase = 'preview' | 'lobby' | 'work' | 'finished';

export interface FeaturedWodCardPresentation {
  phase: FeaturedWodCardPhase;
  /** Primary status line under the schedule metadata. */
  statusLine: string;
  showJoinLobby: boolean;
}

/**
 * Maps Featured WOD RPC + wall clock to landing-card copy/CTA.
 * Lock strings use product-specified casing.
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
    };
  }

  const phase = resolveCardPhase(featured, nowMs);

  if (phase === 'work') {
    return {
      phase,
      statusLine: 'Session locked, amrap in progress.',
      showJoinLobby: false,
    };
  }

  if (phase === 'finished') {
    return {
      phase,
      statusLine: 'Session locked, AMRAP ended.',
      showJoinLobby: false,
    };
  }

  return {
    phase: 'lobby',
    statusLine: `${scheduledLabel}${attendeeSuffix}`,
    showJoinLobby: true,
  };
}

function resolveCardPhase(featured: FeaturedWod, nowMs: number): FeaturedWodCardPhase {
  if (featured.state === 'finished') {
    return 'finished';
  }

  const scheduledAtMs = Date.parse(featured.scheduledAt);
  if (Number.isFinite(scheduledAtMs)) {
    const clock = computeFeaturedSessionClock({
      scheduledAtMs,
      durationMinutes: featured.durationMinutes,
      nowMs,
    });
    if (clock.phase === 'work') {
      return 'work';
    }
    if (clock.phase === 'finished') {
      return 'finished';
    }
  }

  if (featured.state === 'work') {
    return 'work';
  }

  return 'lobby';
}
