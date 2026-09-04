import { describe, expect, it } from 'vitest';
import { parseMissionLiveStatePayload } from './getMissionLiveState';

describe('parseMissionLiveStatePayload', () => {
  it('parses an ok snapshot', () => {
    const result = parseMissionLiveStatePayload({
      ok: true,
      mission: {
        id: 'm1',
        duration_minutes: 10,
        workout: [{ name: 'Squat', target: 10, unit: 'reps' }],
        template_id: null,
        state: 'waiting',
        time_left_sec: 0,
        is_paused: false,
        started_at: null,
        scheduled_at: null,
        rally_point_countdown_ends_at: null,
        segment_index: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        is_featured: false,
        rally_point_id: null,
      },
      participants: [
        {
          id: 'p1',
          mission_id: 'm1',
          nickname: 'Athlete',
          role: 'host',
          joined_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      rounds: [],
      messages: [],
      segment_results: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.mission?.id).toBe('m1');
    expect(result.data.participants).toHaveLength(1);
    expect(result.data.incremental).toBe(false);
    expect(result.data.missionClock).toBeNull();
    expect(result.data.participantIds).toBeNull();
  });

  it('parses incremental mission clock without workout and participant_ids', () => {
    const result = parseMissionLiveStatePayload({
      ok: true,
      incremental: true,
      mission: {
        id: 'm1',
        duration_minutes: 10,
        template_id: null,
        state: 'work',
        time_left_sec: 500,
        is_paused: false,
        started_at: '2026-01-01T00:01:00.000Z',
        scheduled_at: null,
        rally_point_countdown_ends_at: null,
        segment_index: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        is_featured: false,
        rally_point_id: null,
      },
      participants: [],
      participant_ids: ['p1', 'p2'],
      rounds: [],
      messages: [],
      segment_results: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.mission).toBeNull();
    expect(result.data.missionClock?.state).toBe('work');
    expect(result.data.missionClock?.time_left_sec).toBe(500);
    expect(result.data.participantIds).toEqual(['p1', 'p2']);
    expect(result.data.incremental).toBe(true);
  });

  it('surfaces invalid_claim_token failures', () => {
    expect(parseMissionLiveStatePayload({ ok: false, reason: 'invalid_claim_token' })).toEqual({
      ok: false,
      reason: 'invalid_claim_token',
    });
  });
});
