import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canDeleteMyMission,
  countRoundsForSegment,
  computeMyMissionBaseScore,
  deleteIncompleteMission,
  displayMyMissionScore,
  formatMyMissionScoreDisplay,
  myMissionWorkoutTitle,
} from './myMissions';
import type { MyMissionEntry } from './myMissions';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

function baseEntry(overrides: Partial<MyMissionEntry> = {}): MyMissionEntry {
  return {
    participantId: '11111111-1111-4111-8111-111111111111',
    nickname: 'Justin',
    joinedAt: '2026-08-22T12:00:00.000Z',
    role: 'host',
    missionId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-08-22T12:00:00.000Z',
    scheduledAt: null,
    isFeatured: false,
    durationMinutes: 5,
    workout: [
      { name: 'Burpees', target: 20, unit: 'reps' },
      { name: 'Air squats', target: 20, unit: 'reps' },
    ],
    templateId: null,
    state: 'waiting',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
    scoreBreakdown: null,
    coachWorkoutName: null,
    ...overrides,
  };
}

describe('myMissions helpers', () => {
  it('myMissionWorkoutTitle prefers coach name over template', () => {
    expect(
      myMissionWorkoutTitle(
        baseEntry({
          coachWorkoutName: 'Crimp Conditioning',
          templateId: 'the-pendulum',
        })
      )
    ).toBe('Crimp Conditioning');
  });

  it('myMissionWorkoutTitle resolves library template names', () => {
    expect(myMissionWorkoutTitle(baseEntry({ templateId: 'the-pendulum' }))).toBe('The Pendulum');
  });

  it('myMissionWorkoutTitle falls back to Workout', () => {
    expect(myMissionWorkoutTitle(baseEntry())).toBe('Workout');
  });

  it('countRoundsForSegment filters by segment index', () => {
    const rounds = [{ segment_index: 0 }, { segment_index: 0 }, { segment_index: 1 }];

    expect(countRoundsForSegment(rounds, 0)).toBe(2);
    expect(countRoundsForSegment(rounds, 1)).toBe(1);
    expect(countRoundsForSegment(rounds, 2)).toBe(0);
  });

  it('computeMyMissionBaseScore combines rounds and partial reps', () => {
    const entry = baseEntry({
      state: 'finished',
      roundCount: 4,
      partialReps: 15,
    });

    expect(computeMyMissionBaseScore(entry)).toBe(175);
  });

  it('displayMyMissionScore prefers persisted finalScore', () => {
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

    expect(displayMyMissionScore(entry)).toBe(302);
  });

  it('displayMyMissionScore falls back to base score for legacy rows', () => {
    const entry = baseEntry({
      state: 'finished',
      roundCount: 4,
      partialReps: 15,
    });

    expect(displayMyMissionScore(entry)).toBe(175);
  });

  it('formatMyMissionScoreDisplay labels unscorable workouts as rounds', () => {
    const entry = baseEntry({
      state: 'finished',
      workout: [{ name: 'Run', unit: 'm', target: 400 }],
      roundCount: 4,
    });

    expect(formatMyMissionScoreDisplay(entry)).toBe('4 rounds');
  });

  it('canDeleteMyMission is true for host without score breakdown', () => {
    expect(canDeleteMyMission(baseEntry())).toBe(true);
  });

  it('canDeleteMyMission is false for joiners', () => {
    expect(canDeleteMyMission(baseEntry({ role: 'joiner' }))).toBe(false);
  });

  it('canDeleteMyMission is false when score breakdown exists', () => {
    expect(
      canDeleteMyMission(
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

describe('deleteIncompleteMission', () => {
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
      success: true,
    });

    const result = await deleteIncompleteMission('22222222-2222-4222-8222-222222222222');

    expect(rpcMock).toHaveBeenCalledWith('delete_incomplete_mission', {
      p_mission_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.error).toBeNull();
  });

  it('accepts featured cancel responses that finish instead of deleting', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, cancelledFeatured: true },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });

    const result = await deleteIncompleteMission('22222222-2222-4222-8222-222222222222');

    expect(result.error).toBeNull();
  });

  it('maps completed-mission RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Completed missions cannot be deleted',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
        toJSON() {
          return {
            message: this.message,
            name: this.name,
            details: this.details,
            hint: this.hint,
            code: this.code,
          };
        },
      },
      count: null,
      status: 400,
      statusText: 'Bad Request',
      success: false,
    });

    const result = await deleteIncompleteMission('22222222-2222-4222-8222-222222222222');

    expect(result.error?.message).toBe('Completed missions cannot be deleted.');
  });
});
