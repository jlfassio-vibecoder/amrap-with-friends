import { describe, expect, it } from 'vitest';
import {
  cardMovements,
  formatMovement,
  formatSplit,
  roundSplits,
  shouldDrawBoard,
} from '@/lib/share/cardContent';
import type { ReplayData } from '@/lib/share/types';

function data(overrides: Partial<ReplayData['mission']> = {}, participants = 1): ReplayData {
  return {
    mission: {
      id: 'm1',
      templateId: 'the-piston',
      workout: {
        movements: [
          { name: 'Air Squats', reps: 10 },
          { name: 'Hand-Release Push-ups', reps: 10 },
        ],
      },
      capSeconds: 300,
      durationMinutes: 5,
      intensityTier: 3,
      state: 'finished',
      startedAt: null,
      segmentIndex: 0,
      ...overrides,
    },
    participants: Array.from({ length: participants }, (_, index) => ({
      participantId: `p${index}`,
      userId: null,
      displayName: `Athlete ${index}`,
      isMe: index === 0,
      finalRounds: 7,
      finalReps: 0,
      finalScore: 119,
      role: 'host',
    })),
    rounds: [],
  };
}

describe('cardMovements', () => {
  it('reads the movements the mission was actually run with', () => {
    expect(cardMovements(data()).map(formatMovement)).toEqual([
      '10 Air Squats',
      '10 Hand-Release Push-ups',
    ]);
  });

  it('handles a movement with a unit, and one with no reps', () => {
    const withUnits = data({
      workout: {
        movements: [{ name: 'Row', reps: 200, unit: 'm' }, { name: 'Plank' }],
      },
    });
    expect(cardMovements(withUnits).map(formatMovement)).toEqual(['200 m Row', 'Plank']);
  });

  it('survives a malformed or missing workout rather than blanking the card', () => {
    expect(cardMovements(data({ workout: null }))).toEqual([]);
    expect(cardMovements(data({ workout: { movements: 'nope' } }))).toEqual([]);
    expect(cardMovements(data({ workout: { movements: [{ reps: 5 }, 'x', null] } }))).toEqual([]);
  });
});

describe('roundSplits', () => {
  it('turns timestamps into per-round durations', () => {
    // The scorecard showed 0:08, 0:10, 0:10 for these; the card must agree.
    const rounds = [
      { participantId: 'p0', n: 1, atSeconds: 8 },
      { participantId: 'p0', n: 2, atSeconds: 18 },
      { participantId: 'p0', n: 3, atSeconds: 28 },
    ];
    expect(roundSplits(rounds, 'p0')).toEqual([
      { n: 1, seconds: 8 },
      { n: 2, seconds: 10 },
      { n: 3, seconds: 10 },
    ]);
  });

  it('ignores other athletes rounds', () => {
    const rounds = [
      { participantId: 'p1', n: 1, atSeconds: 5 },
      { participantId: 'p0', n: 1, atSeconds: 20 },
    ];
    expect(roundSplits(rounds, 'p0')).toEqual([{ n: 1, seconds: 20 }]);
  });

  it('sorts by time, so an out-of-order payload cannot produce a negative split', () => {
    const rounds = [
      { participantId: 'p0', n: 2, atSeconds: 30 },
      { participantId: 'p0', n: 1, atSeconds: 10 },
    ];
    expect(roundSplits(rounds, 'p0').every((split) => split.seconds >= 0)).toBe(true);
  });

  it('is empty when nothing was logged', () => {
    expect(roundSplits([], 'p0')).toEqual([]);
  });
});

describe('formatSplit', () => {
  it('matches the clock format on the scorecard', () => {
    expect(formatSplit(8)).toBe('0:08');
    expect(formatSplit(41)).toBe('0:41');
    expect(formatSplit(75)).toBe('1:15');
  });
});

describe('shouldDrawBoard', () => {
  it('draws a board only when there is somebody to compare against', () => {
    // A one-row leaderboard restates the hero and is what left the first card
    // two-thirds empty.
    expect(shouldDrawBoard(data({}, 1))).toBe(false);
    expect(shouldDrawBoard(data({}, 3))).toBe(true);
  });
});
