import { describe, expect, it } from 'vitest';
import {
  boardRows,
  formatScore,
  frameAt,
  myBar,
  rankParticipants,
  resolveVariant,
} from '@/lib/share/timeline';
import type { ReplayData, ReplayParticipant } from '@/lib/share/types';

function participant(overrides: Partial<ReplayParticipant>): ReplayParticipant {
  return {
    participantId: overrides.displayName ?? 'p',
    userId: null,
    displayName: 'Athlete',
    isMe: false,
    finalRounds: 0,
    finalReps: 0,
    role: 'joiner',
    ...overrides,
  };
}

function data(participants: ReplayParticipant[]): ReplayData {
  return {
    mission: {
      id: 'm1',
      templateId: 'blood-shunt',
      workout: null,
      capSeconds: 720,
      durationMinutes: 12,
      intensityTier: 3,
      state: 'finished',
      startedAt: '2026-09-09T10:00:00Z',
      segmentIndex: 0,
    },
    participants,
    rounds: [],
  };
}

describe('rankParticipants', () => {
  it('ranks on rounds, then reps', () => {
    const bars = rankParticipants(
      data([
        participant({ displayName: 'Ana', finalRounds: 6, finalReps: 4 }),
        participant({ displayName: 'Bo', finalRounds: 7, finalReps: 0 }),
        participant({ displayName: 'Cy', finalRounds: 6, finalReps: 9 }),
      ])
    );
    expect(bars.map((bar) => bar.displayName)).toEqual(['Bo', 'Cy', 'Ana']);
    expect(bars.map((bar) => bar.rank)).toEqual([1, 2, 3]);
  });

  it('breaks a full tie by name, so two renders of one mission never differ', () => {
    // Phase 2 encodes 600 frames from this function; an unstable sort would
    // make bars swap places mid-video.
    const tied = [
      participant({ displayName: 'Zoe', finalRounds: 5, finalReps: 3 }),
      participant({ displayName: 'Ada', finalRounds: 5, finalReps: 3 }),
    ];
    expect(rankParticipants(data(tied)).map((bar) => bar.displayName)).toEqual(['Ada', 'Zoe']);
    expect(rankParticipants(data([...tied].reverse())).map((bar) => bar.displayName)).toEqual([
      'Ada',
      'Zoe',
    ]);
  });

  it('marks the athlete regardless of placing', () => {
    const bars = rankParticipants(
      data([
        participant({ displayName: 'Ana', finalRounds: 9 }),
        participant({ displayName: 'Me', finalRounds: 1, isMe: true }),
      ])
    );
    expect(myBar(bars)?.displayName).toBe('Me');
    expect(myBar(bars)?.rank).toBe(2);
  });
});

describe('boardRows', () => {
  const many = Array.from({ length: 8 }, (_, index) =>
    participant({ displayName: `A${index}`, finalRounds: 10 - index })
  );

  it('shows the top five when the athlete is in them', () => {
    const bars = rankParticipants(
      data([
        ...many.slice(0, 7),
        participant({
          displayName: 'Me',
          finalRounds: 99,
          isMe: true,
        }),
      ])
    );
    expect(boardRows(bars)).toHaveLength(5);
    expect(boardRows(bars)[0]?.displayName).toBe('Me');
  });

  it('pins the athlete below the top five when they placed outside it', () => {
    // Being 8th on your own card is fine; being absent from it is not.
    const bars = rankParticipants(
      data([...many, participant({ displayName: 'Me', finalRounds: 0, isMe: true })])
    );
    const rows = boardRows(bars);
    expect(rows).toHaveLength(6);
    expect(rows[5]?.displayName).toBe('Me');
    expect(rows[5]?.rank).toBe(9);
  });

  it('returns only the top five when there is no athlete row at all', () => {
    expect(boardRows(rankParticipants(data(many)))).toHaveLength(5);
  });
});

describe('formatScore', () => {
  it('omits reps when there are none', () => {
    expect(formatScore({ rounds: 7, reps: 12 })).toBe('7 rounds + 12');
    expect(formatScore({ rounds: 7, reps: 0 })).toBe('7 rounds');
  });
});

describe('resolveVariant', () => {
  it('falls back to the result card when there is no squad to show', () => {
    const solo = data([participant({ displayName: 'Me', isMe: true })]);
    expect(resolveVariant(solo, 'squad')).toBe('result');
    expect(resolveVariant(solo, 'result')).toBe('result');
  });

  it('keeps the squad card for a real squad', () => {
    const pair = data([participant({ displayName: 'Me' }), participant({ displayName: 'Ana' })]);
    expect(resolveVariant(pair, 'squad')).toBe('squad');
  });
});

describe('frameAt', () => {
  it('returns the freeze frame with the clock at the cap', () => {
    const frame = frameAt(data([participant({ displayName: 'Me', isMe: true })]));
    expect(frame.phase).toBe('freeze');
    expect(frame.clockSeconds).toBe(720);
    expect(frame.cardBlend).toBe(1);
  });

  it('clamps a time outside the mission', () => {
    const solo = data([participant({ displayName: 'Me', isMe: true })]);
    expect(frameAt(solo, -5).clockSeconds).toBe(0);
    expect(frameAt(solo, 9999).clockSeconds).toBe(720);
  });
});
