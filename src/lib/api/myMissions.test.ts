import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canDeleteMyMission,
  countRoundsForSegment,
  computeMyMissionBaseScore,
  deleteIncompleteMission,
  displayMyMissionScore,
  fetchMyMissions,
  formatMyMissionExerciseLine,
  formatMyMissionScoreDisplay,
  formatMyMissionShareText,
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
    movementCount: 2,
    repsPerRound: 40,
    templateId: null,
    intensityTier: null,
    rallyPointId: null,
    state: 'waiting',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
    hasScoreBreakdown: false,
    scoreBreakdown: null,
    modifiedMovements: [],
    movementVariants: {},
    rpe: null,
    sessionNotes: '',
    checkIns: {},
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

  it('formatMyMissionScoreDisplay shows the reps actually done, not finalScore', () => {
    // 40 reps/round (20 + 20) × 4 rounds + 15 partial = 175. finalScore is
    // deliberately a different number — baseScore adjusted by P.V.I. and
    // Domain is not the same quantity as reps performed, and this must not
    // be shown next to the word "reps".
    const entry = baseEntry({
      state: 'finished',
      roundCount: 4,
      partialReps: 15,
      finalScore: 302,
    });

    expect(formatMyMissionScoreDisplay(entry)).toBe('175 reps');
  });

  it('formatMyMissionExerciseLine includes target and unit', () => {
    expect(formatMyMissionExerciseLine({ name: 'T-Push-ups', target: 10, unit: 'reps' })).toBe(
      'T-Push-ups — 10 reps'
    );
    expect(formatMyMissionExerciseLine({ name: 'Burpees' })).toBe('Burpees');
  });

  it('formatMyMissionScoreDisplay uses repsPerRound when workout is empty', () => {
    const entry = baseEntry({
      state: 'finished',
      workout: [],
      movementCount: 2,
      repsPerRound: 40,
      roundCount: 4,
      partialReps: 15,
    });

    expect(formatMyMissionScoreDisplay(entry)).toBe('175 reps');
  });

  it('formatMyMissionShareText includes title, movements, and meta', () => {
    const entry = baseEntry({
      coachWorkoutName: 'Tension Grid',
      createdAt: '2026-08-31T18:00:00.000Z',
      durationMinutes: 10,
      state: 'finished',
      // 42 reps/round (10 + 12 + 20) × 10 rounds + 4 partial = 424 — the
      // share text must show this computed rep count, not a finalScore that
      // happens to differ from it (a P.V.I./Domain multiplier would make
      // finalScore a different number than the reps actually performed).
      roundCount: 10,
      partialReps: 4,
      finalScore: 487,
      workout: [
        { name: 'T-Push-ups', target: 10, unit: 'reps' },
        { name: 'Strict Sit-ups', target: 12, unit: 'reps' },
        { name: 'High Knees', target: 20, unit: 'reps' },
      ],
    });

    const text = formatMyMissionShareText(entry);
    expect(text).toContain('Tension Grid');
    expect(text).toContain('T-Push-ups — 10 reps');
    expect(text).toContain('Strict Sit-ups — 12 reps');
    expect(text).toContain('High Knees — 20 reps');
    expect(text).toContain('10 min · 424 reps · Finished');
    expect(text.indexOf('Tension Grid')).toBeLessThan(text.indexOf('T-Push-ups'));
    expect(text.indexOf('High Knees')).toBeLessThan(text.indexOf('10 min'));
  });

  it('formatMyMissionShareText omits movements when workout is empty', () => {
    const entry = baseEntry({
      coachWorkoutName: 'Empty Grid',
      workout: [],
      movementCount: 0,
      repsPerRound: null,
      durationMinutes: 5,
      state: 'waiting',
    });

    const text = formatMyMissionShareText(entry);
    expect(text).toContain('Empty Grid');
    expect(text).not.toContain('—');
    expect(text).toContain('5 min · 0 rounds · Waiting');
    expect(text.split('\n\n')).toHaveLength(2);
  });

  it('canDeleteMyMission is true for host without score breakdown', () => {
    expect(canDeleteMyMission(baseEntry())).toBe(true);
  });

  it('canDeleteMyMission is false for joiners', () => {
    expect(canDeleteMyMission(baseEntry({ role: 'joiner' }))).toBe(false);
  });

  it('canDeleteMyMission is false when the mission has finished', () => {
    expect(canDeleteMyMission(baseEntry({ state: 'finished' }))).toBe(false);
  });

  it('canDeleteMyMission is false when score breakdown exists', () => {
    expect(
      canDeleteMyMission(
        baseEntry({
          state: 'finished',
          finalScore: 100,
          hasScoreBreakdown: true,
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

describe('fetchMyMissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses slim list fields and embedded chains', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        missions: [
          {
            participant_id: '11111111-1111-4111-8111-111111111111',
            nickname: 'Justin',
            joined_at: '2026-08-22T12:00:00.000Z',
            role: 'host',
            mission_id: '22222222-2222-4222-8222-222222222222',
            created_at: '2026-08-22T12:00:00.000Z',
            scheduled_at: null,
            is_featured: false,
            duration_minutes: 5,
            template_id: 'the-piston',
            rally_point_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            movement_count: 1,
            reps_per_round: 10,
            has_score_breakdown: false,
            state: 'waiting',
            segment_index: 0,
            round_count: 0,
            partial_reps: 0,
            final_score: null,
            coach_workout_name: null,
          },
        ],
        chains: {
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': [
            {
              id: 'c0',
              position: 0,
              duration_minutes: 5,
              template_id: 'the-piston',
              intensity_tier: 3,
              started_mission_id: '22222222-2222-4222-8222-222222222222',
              workout: [],
            },
            {
              id: 'c1',
              position: 1,
              duration_minutes: 5,
              template_id: 'the-metronome',
              intensity_tier: 3,
              started_mission_id: null,
              workout: [{ name: 'Fast Air Squats', target: 15 }],
            },
          ],
        },
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await fetchMyMissions();

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.rallyPointId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(result.data?.[0]?.templateId).toBe('the-piston');
    expect(result.data?.[0]?.movementCount).toBe(1);
    expect(result.data?.[0]?.repsPerRound).toBe(10);
    expect(result.data?.[0]?.hasScoreBreakdown).toBe(false);
    expect(result.data?.[0]?.workout).toEqual([]);
    expect(result.chains['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']).toHaveLength(2);
    expect(result.chains['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']?.[1]?.workout).toEqual([
      { name: 'Fast Air Squats', target: 15 },
    ]);
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
