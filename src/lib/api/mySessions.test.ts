import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canDeleteMySession,
  countRoundsForSegment,
  computeMySessionBaseScore,
  deleteIncompleteSession,
  displayMySessionScore,
  formatMySessionScoreDisplay,
} from './mySessions';
import type { MySessionEntry } from './mySessions';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

function baseEntry(overrides: Partial<MySessionEntry> = {}): MySessionEntry {
  return {
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
    state: 'waiting',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
    scoreBreakdown: null,
    ...overrides,
  };
}

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
    const entry = baseEntry({
      state: 'finished',
      roundCount: 4,
      partialReps: 15,
    });

    expect(computeMySessionBaseScore(entry)).toBe(175);
  });

  it('displayMySessionScore prefers persisted finalScore', () => {
    const entry = baseEntry({
      state: 'finished',
      durationMinutes: 15,
      roundCount: 4,
      partialReps: 15,
      finalScore: 302,
      scoreBreakdown: {
        baseScore: 175,
        pvi: 0,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
      },
    });

    expect(displayMySessionScore(entry)).toBe(302);
  });

  it('displayMySessionScore falls back to base score for legacy rows', () => {
    const entry = baseEntry({
      state: 'finished',
      roundCount: 4,
      partialReps: 15,
    });

    expect(displayMySessionScore(entry)).toBe(175);
  });

  it('formatMySessionScoreDisplay labels unscorable workouts as rounds', () => {
    const entry = baseEntry({
      state: 'finished',
      workout: [{ name: 'Run', unit: 'm', target: 400 }],
      roundCount: 4,
    });

    expect(formatMySessionScoreDisplay(entry)).toBe('4 rounds');
  });

  it('canDeleteMySession is true for host without score breakdown', () => {
    expect(canDeleteMySession(baseEntry())).toBe(true);
  });

  it('canDeleteMySession is false for joiners', () => {
    expect(canDeleteMySession(baseEntry({ role: 'joiner' }))).toBe(false);
  });

  it('canDeleteMySession is false when score breakdown exists', () => {
    expect(
      canDeleteMySession(
        baseEntry({
          state: 'finished',
          finalScore: 100,
          scoreBreakdown: {
            baseScore: 100,
            pvi: null,
            pviMultiplier: 1,
            domainWeight: 1,
            finalScore: 100,
          },
        })
      )
    ).toBe(false);
  });
});

describe('deleteIncompleteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC and returns success', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await deleteIncompleteSession(
      '22222222-2222-4222-8222-222222222222'
    );

    expect(rpcMock).toHaveBeenCalledWith('delete_incomplete_session', {
      p_session_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.error).toBeNull();
  });

  it('maps completed-session RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Completed sessions cannot be deleted',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
      },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    });

    const result = await deleteIncompleteSession(
      '22222222-2222-4222-8222-222222222222'
    );

    expect(result.error?.message).toBe('Completed sessions cannot be deleted.');
  });
});
