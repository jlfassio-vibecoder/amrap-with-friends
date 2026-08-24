import { describe, it, expect } from 'vitest';
import { countRoundsForSegment, computeMySessionBaseScore } from './mySessions';
import type { MySessionEntry } from './mySessions';

describe('mySessions helpers', () => {
  it('countRoundsForSegment filters by segment index', () => {
    const rounds = [
      { segment_index: 0 },
      { segment_index: 0 },
      { segment_index: 1 },
    ];

    expect(countRoundsForSegment(rounds, 0)).toBe(2);
    expect(countRoundsForSegment(rounds, 1)).toBe(1);
    expect(countRoundsForSegment(rounds, 2)).toBe(0);
  });

  it('computeMySessionBaseScore combines rounds and partial reps', () => {
    const entry: MySessionEntry = {
      participantId: '11111111-1111-4111-8111-111111111111',
      nickname: 'Justin',
      joinedAt: '2026-08-22T12:00:00.000Z',
      role: 'host',
      sessionId: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-08-22T12:00:00.000Z',
      durationMinutes: 5,
      workout: [
        { name: 'Burpees', target: 20, unit: 'reps' },
        { name: 'Air squats', target: 20, unit: 'reps' },
      ],
      state: 'finished',
      segmentIndex: 0,
      roundCount: 4,
      partialReps: 15,
    };

    expect(computeMySessionBaseScore(entry)).toBe(175);
  });
});
