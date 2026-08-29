import { describe, expect, it } from 'vitest';
import type { FeaturedWod } from '@/lib/api/featuredWod';
import {
  FEATURED_WOD_LOBBY_LEAD_MS,
  getFeaturedWodCardPresentation,
} from './featuredWodCardPresentation';

const SCHEDULED = '2026-09-01T13:00:00.000Z';
const SCHEDULED_MS = Date.parse(SCHEDULED);

function featured(overrides: Partial<FeaturedWod> = {}): FeaturedWod {
  return {
    workoutName: 'Sunrise AMRAP',
    focus: 'Full body',
    durationMinutes: 15,
    intensityTier: 4,
    tags: [],
    scheduledAt: SCHEDULED,
    sessionId: '22222222-2222-4222-8222-222222222222',
    state: 'waiting',
    startedAt: null,
    attendeeCount: 3,
    ...overrides,
  };
}

describe('getFeaturedWodCardPresentation', () => {
  it('shows preview copy when no session is generated yet', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ sessionId: null, state: null, attendeeCount: null }),
      SCHEDULED_MS - 60_000
    );
    expect(presentation.phase).toBe('preview');
    expect(presentation.showJoinLobby).toBe(false);
    expect(presentation.showLobbyOpensSoon).toBe(true);
    expect(presentation.statusLine.length).toBeGreaterThan(0);
  });

  it('withholds join until the 15-minute lead window even when a session exists', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'waiting' }),
      SCHEDULED_MS - FEATURED_WOD_LOBBY_LEAD_MS - 60_000
    );
    expect(presentation.phase).toBe('lobby');
    expect(presentation.showJoinLobby).toBe(false);
    expect(presentation.showLobbyOpensSoon).toBe(true);
    expect(presentation.statusLine).toContain('joining');
  });

  it('shows lobby join inside the 15-minute lead window', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'waiting' }),
      SCHEDULED_MS - 60_000
    );
    expect(presentation.phase).toBe('lobby');
    expect(presentation.showJoinLobby).toBe(true);
    expect(presentation.showLobbyOpensSoon).toBe(false);
    expect(presentation.statusLine).toContain('joining');
  });

  it('shows lobby during setup, not amrap-in-progress', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'setup' }),
      SCHEDULED_MS + 3_000
    );
    expect(presentation.phase).toBe('lobby');
    expect(presentation.showJoinLobby).toBe(true);
    expect(presentation.statusLine).not.toContain('amrap in progress');
  });

  it('locks with exact in-progress copy once work starts', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({
        state: 'work',
        startedAt: new Date(SCHEDULED_MS + 10_000).toISOString(),
      }),
      SCHEDULED_MS + 10_000
    );
    expect(presentation.phase).toBe('work');
    expect(presentation.showJoinLobby).toBe(false);
    expect(presentation.showLobbyOpensSoon).toBe(false);
    expect(presentation.statusLine).toBe('Session locked, amrap in progress.');
  });

  it('locks with exact ended copy after full duration', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'work' }),
      SCHEDULED_MS + 10_000 + 15 * 60_000
    );
    expect(presentation.phase).toBe('finished');
    expect(presentation.showJoinLobby).toBe(false);
    expect(presentation.statusLine).toBe('Session locked, AMRAP ended.');
  });

  it('treats RPC finished as ended', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'finished' }),
      SCHEDULED_MS + 10_000 + 15 * 60_000 + 60_000
    );
    expect(presentation.phase).toBe('finished');
    expect(presentation.statusLine).toBe('Session locked, AMRAP ended.');
  });
});
