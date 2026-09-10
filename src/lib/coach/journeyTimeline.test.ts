import { describe, expect, it } from 'vitest';
import {
  groupJourneyByDay,
  journeyEntryIdentity,
  journeyEntryLabel,
  journeyStage,
  journeyStageLabel,
  unfinishedMissionCount,
  type JourneyEntry,
  type JourneyLifetime,
} from '@/lib/coach/journeyTimeline';

function lifetime(overrides: Partial<JourneyLifetime> = {}): JourneyLifetime {
  return {
    missionsHosted: 0,
    missionsJoined: 0,
    missionsTotal: 0,
    missionsCompleted: 0,
    missionsFinishedState: 0,
    bestScore: null,
    totalWorkoutMinutes: 0,
    activeDays: 0,
    ...overrides,
  };
}

function missionEntry(at: string, completed: boolean, guest = false): JourneyEntry {
  return {
    at,
    kind: 'mission',
    payload: {
      missionId: 'm1',
      role: 'host',
      state: completed ? 'finished' : 'work',
      templateId: 'blood-shunt',
      durationMinutes: 10,
      intensityTier: 3,
      finalScore: completed ? 412 : null,
      completed,
      guest,
    },
  };
}

function eventEntry(at: string, eventName: string, signedIn = false): JourneyEntry {
  return {
    at,
    kind: 'event',
    payload: { eventName, route: '/', missionId: null, anonId: 'a1', signedIn, props: {} },
  };
}

describe('journeyStage', () => {
  it('separates looking from training', () => {
    expect(journeyStage(lifetime())).toBe('browsed');
    expect(journeyStage(lifetime({ missionsTotal: 3 }))).toBe('started_never_finished');
    expect(journeyStage(lifetime({ missionsTotal: 1, missionsCompleted: 1 }))).toBe(
      'completed_once'
    );
    expect(journeyStage(lifetime({ missionsTotal: 4, missionsCompleted: 2 }))).toBe('returning');
    expect(journeyStage(lifetime({ missionsTotal: 9, missionsCompleted: 5 }))).toBe('regular');
  });

  it('does not promote someone on participation alone', () => {
    // 20 missions and nothing scored is the drop-off case, not a regular.
    expect(journeyStage(lifetime({ missionsTotal: 20, missionsCompleted: 0 }))).toBe(
      'started_never_finished'
    );
  });

  it('labels every stage', () => {
    expect(journeyStageLabel(journeyStage(lifetime()))).toContain('Browsed only');
    expect(journeyStageLabel(journeyStage(lifetime({ missionsTotal: 2 })))).toContain(
      'never completed'
    );
  });
});

describe('unfinishedMissionCount', () => {
  it('counts missions with no score for this athlete', () => {
    expect(unfinishedMissionCount(lifetime({ missionsTotal: 7, missionsCompleted: 2 }))).toBe(5);
  });

  it('never goes negative', () => {
    expect(unfinishedMissionCount(lifetime({ missionsTotal: 1, missionsCompleted: 3 }))).toBe(0);
  });
});

describe('journeyEntryLabel', () => {
  it('reports the outcome of a mission, not just that it happened', () => {
    expect(journeyEntryLabel(missionEntry('2026-09-01T10:00:00Z', true))).toBe(
      '10m mission as Host — completed · score 412'
    );
    expect(journeyEntryLabel(missionEntry('2026-09-01T10:00:00Z', false))).toBe(
      '10m mission as Host — no score · mission work'
    );
  });

  it('humanizes event names', () => {
    expect(journeyEntryLabel(eventEntry('2026-09-01T10:00:00Z', 'rally_link_copied'))).toBe(
      'Rally link copied'
    );
  });
});

describe('journeyEntryIdentity', () => {
  it('reports identity at the time of the entry', () => {
    expect(journeyEntryIdentity(missionEntry('2026-09-01T10:00:00Z', true, true))).toBe('guest');
    expect(journeyEntryIdentity(missionEntry('2026-09-01T10:00:00Z', true, false))).toBe(
      'signed_in'
    );
    expect(journeyEntryIdentity(eventEntry('2026-09-01T10:00:00Z', 'page', false))).toBe('guest');
    expect(journeyEntryIdentity(eventEntry('2026-09-01T10:00:00Z', 'page', true))).toBe(
      'signed_in'
    );
  });
});

describe('groupJourneyByDay', () => {
  it('buckets consecutive entries by calendar day, preserving order', () => {
    const grouped = groupJourneyByDay([
      eventEntry('2026-09-02T11:00:00Z', 'a'),
      eventEntry('2026-09-02T09:00:00Z', 'b'),
      eventEntry('2026-09-01T23:00:00Z', 'c'),
    ]);
    expect(grouped.map((g) => g.day)).toEqual(['2026-09-02', '2026-09-01']);
    expect(grouped[0]?.entries).toHaveLength(2);
    expect(grouped[1]?.entries).toHaveLength(1);
  });

  it('returns nothing for an empty timeline', () => {
    expect(groupJourneyByDay([])).toEqual([]);
  });
});
