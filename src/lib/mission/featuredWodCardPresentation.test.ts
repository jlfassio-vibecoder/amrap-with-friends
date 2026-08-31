import { describe, expect, it } from 'vitest';
import type { FeaturedWod } from '@/lib/api/featuredWod';
import {
  FEATURED_WOD_RALLY_POINT_LEAD_MS,
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
    missionId: '22222222-2222-4222-8222-222222222222',
    state: 'waiting',
    startedAt: null,
    attendeeCount: 3,
    ...overrides,
  };
}

describe('getFeaturedWodCardPresentation', () => {
  it('shows preview copy when no mission is generated yet', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ missionId: null, state: null, attendeeCount: null }),
      SCHEDULED_MS - 60_000
    );
    expect(presentation.phase).toBe('preview');
    expect(presentation.showJoinRallyPoint).toBe(false);
    expect(presentation.showRallyPointOpensSoon).toBe(true);
    expect(presentation.statusLine.length).toBeGreaterThan(0);
  });

  it('withholds join until the 15-minute lead window even when a mission exists', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'waiting' }),
      SCHEDULED_MS - FEATURED_WOD_RALLY_POINT_LEAD_MS - 60_000
    );
    expect(presentation.phase).toBe('rallyPoint');
    expect(presentation.showJoinRallyPoint).toBe(false);
    expect(presentation.showRallyPointOpensSoon).toBe(true);
    expect(presentation.statusLine).toContain('joining');
  });

  it('shows rally point join inside the 15-minute lead window while waiting', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'waiting' }),
      SCHEDULED_MS - 60_000
    );
    expect(presentation.phase).toBe('rallyPoint');
    expect(presentation.showJoinRallyPoint).toBe(true);
    expect(presentation.showRallyPointOpensSoon).toBe(false);
    expect(presentation.statusLine).toContain('joining');
  });

  it('stays rallyPoint after scheduled_at while still waiting (manual start)', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'waiting' }),
      SCHEDULED_MS + 60_000
    );
    expect(presentation.phase).toBe('rallyPoint');
    expect(presentation.showJoinRallyPoint).toBe(true);
    expect(presentation.statusLine).not.toContain('amrap in progress');
  });

  it('locks once host has started setup', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'setup' }),
      SCHEDULED_MS + 3_000
    );
    expect(presentation.phase).toBe('work');
    expect(presentation.showJoinRallyPoint).toBe(false);
    expect(presentation.statusLine).toBe('Mission locked, amrap in progress.');
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
    expect(presentation.showJoinRallyPoint).toBe(false);
    expect(presentation.showRallyPointOpensSoon).toBe(false);
    expect(presentation.statusLine).toBe('Mission locked, amrap in progress.');
  });

  it('treats RPC finished as ended', () => {
    const presentation = getFeaturedWodCardPresentation(
      featured({ state: 'finished' }),
      SCHEDULED_MS + 10_000 + 15 * 60_000 + 60_000
    );
    expect(presentation.phase).toBe('finished');
    expect(presentation.statusLine).toBe('Mission locked, AMRAP ended.');
  });
});
