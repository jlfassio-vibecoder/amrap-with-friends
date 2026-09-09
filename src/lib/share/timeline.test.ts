import { describe, expect, it } from 'vitest';
import {
  boardRows,
  formatScore,
  frameAt,
  frameAtVideoTime,
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
    finalScore: null,
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

  it('says "1 round", which the hero on a real card did not', () => {
    // The card is the thing a stranger sees first, and it read "1 rounds".
    expect(formatScore({ rounds: 1, reps: 0 })).toBe('1 round');
    expect(formatScore({ rounds: 1, reps: 12 })).toBe('1 round + 12');
  });

  it('treats zero as plural', () => {
    expect(formatScore({ rounds: 0, reps: 0 })).toBe('0 rounds');
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

describe('frameAtVideoTime', () => {
  const cap = 720;

  function racing(): ReplayData {
    const base = data([
      participant({
        participantId: 'me',
        displayName: 'Me',
        isMe: true,
        finalRounds: 3,
        finalReps: 5,
      }),
      participant({ participantId: 'ana', displayName: 'Ana', finalRounds: 2, finalReps: 0 }),
    ]);
    base.rounds = [
      { participantId: 'me', n: 1, atSeconds: 100 },
      { participantId: 'ana', n: 1, atSeconds: 200 },
      { participantId: 'me', n: 2, atSeconds: 300 },
      { participantId: 'ana', n: 2, atSeconds: 400 },
      { participantId: 'me', n: 3, atSeconds: 715 },
    ];
    return base;
  }

  it('is deterministic — the encoder renders 600 frames and cannot get two answers', () => {
    const first = frameAtVideoTime(racing(), 6.25, 'full20');
    const second = frameAtVideoTime(racing(), 6.25, 'full20');
    expect(first).toEqual(second);
  });

  it('walks the clock from zero to the cap across the cut', () => {
    const race = racing();
    expect(frameAtVideoTime(race, 0, 'full20').clockSeconds).toBe(0);
    expect(frameAtVideoTime(race, 20, 'full20').clockSeconds).toBe(cap);
    const middle = frameAtVideoTime(race, 5, 'full20').clockSeconds;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(cap);
  });

  it('names each phase at its boundary', () => {
    const race = racing();
    expect(frameAtVideoTime(race, 0, 'full20').phase).toBe('title');
    expect(frameAtVideoTime(race, 2, 'full20').phase).toBe('race');
    expect(frameAtVideoTime(race, 8, 'full20').phase).toBe('finish');
    expect(frameAtVideoTime(race, 18, 'full20').phase).toBe('freeze');
  });

  it('only counts rounds that have already landed', () => {
    const race = racing();
    // Two seconds in we are still on the title card, at mission time zero.
    expect(frameAtVideoTime(race, 0.5, 'full20').bars.every((bar) => bar.rounds === 0)).toBe(true);
    const end = frameAtVideoTime(race, 20, 'full20');
    expect(end.bars.find((bar) => bar.highlight)?.rounds).toBe(3);
  });

  it('ends on the same order the card shows', () => {
    // The freeze frame crossfades into the card; a different order would make
    // the leaderboard jump at the moment they meet.
    const race = racing();
    const video = frameAtVideoTime(race, 20, 'full20').bars.map((bar) => bar.displayName);
    const card = frameAt(race).bars.map((bar) => bar.displayName);
    expect(video).toEqual(card);
  });

  it('blends into the card only during the freeze', () => {
    const race = racing();
    expect(frameAtVideoTime(race, 17.9, 'full20').cardBlend).toBe(0);
    expect(frameAtVideoTime(race, 20, 'full20').cardBlend).toBe(1);
  });

  it('flashes a bar when a round lands, and lets it decay', () => {
    const race = racing();
    // Me's third round lands at mission second 715. The finish phase runs
    // mission 710-720 across video 8-18, so that is video second 13, and the
    // flash decays over half a mission second from there.
    expect(
      frameAtVideoTime(race, 13.1, 'full20').bars.find((b) => b.highlight)?.flash ?? 0
    ).toBeGreaterThan(0);
    expect(frameAtVideoTime(race, 14, 'full20').bars.find((b) => b.highlight)?.flash).toBe(0);
  });

  it('handles a mission shorter than the real-time tail without running backwards', () => {
    const short = racing();
    short.mission.capSeconds = 5;
    short.rounds = [{ participantId: 'me', n: 1, atSeconds: 2 }];
    const frames = [0, 5, 10, 15, 20].map((t) => frameAtVideoTime(short, t, 'full20'));
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i]!.clockSeconds).toBeGreaterThanOrEqual(frames[i - 1]!.clockSeconds);
    }
  });

  it('runs the short cut on its own timescale', () => {
    const race = racing();
    expect(frameAtVideoTime(race, 9, 'story9').phase).toBe('freeze');
    expect(frameAtVideoTime(race, 9, 'story9').clockSeconds).toBe(cap);
  });
});
