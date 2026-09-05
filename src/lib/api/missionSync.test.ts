import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateMissionState,
  logRound,
  submitParticipantResult,
  setRallyPointCountdown,
  cancelRallyPointCountdown,
} from './missionSync';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const rpcMock = vi.mocked(supabase.rpc);
const invokeMock = vi.mocked(supabase.functions.invoke);

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const ROUND_ID = '33333333-3333-4333-8333-333333333333';

describe('missionSync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateMissionState calls RPC with correct args and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        mission_id: MISSION_ID,
        state: 'work',
        time_left_sec: 897,
        is_paused: false,
        started_at: '2026-08-22T12:00:00.000Z',
        segment_index: 0,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await updateMissionState({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
      state: 'work',
      timeLeftSec: 897,
      isPaused: false,
      startedAt: '2026-08-22T12:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('update_mission_state', {
      p_mission_id: MISSION_ID,
      p_host_token: 'host-secret',
      p_state: 'work',
      p_time_left_sec: 897,
      p_is_paused: false,
      p_started_at: '2026-08-22T12:00:00.000Z',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      missionId: MISSION_ID,
      state: 'work',
      timeLeftSec: 897,
      isPaused: false,
      startedAt: '2026-08-22T12:00:00.000Z',
      segmentIndex: 0,
    });
  });

  it('updateMissionState parses invalid_host_token without error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_host_token' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await updateMissionState({
      missionId: MISSION_ID,
      hostToken: 'wrong',
      state: 'setup',
      timeLeftSec: 10,
      isPaused: false,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'invalid_host_token' });
  });

  it('updateMissionState maps RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Mission not found',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'PGRST116',
        toJSON: () => ({
          name: 'PostgrestError',
          message: 'Mission not found',
          details: '',
          hint: '',
          code: 'PGRST116',
        }),
      },
      success: false,
      count: null,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await updateMissionState({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
      state: 'setup',
      timeLeftSec: 10,
      isPaused: false,
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Mission not found.');
  });

  it('logRound calls RPC with correct args and parses success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        round_id: ROUND_ID,
        round_index: 2,
        elapsed_sec_at_round: 45,
        segment_index: 0,
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await logRound({
      missionId: MISSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      roundIndex: 2,
      elapsedSecAtRound: 45,
      segmentIndex: 0,
    });

    expect(rpcMock).toHaveBeenCalledWith('log_round', {
      p_mission_id: MISSION_ID,
      p_participant_id: PARTICIPANT_ID,
      p_claim_token: 'claim-token',
      p_round_index: 2,
      p_elapsed_sec_at_round: 45,
      p_segment_index: 0,
      p_missed_log_reps: null,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      roundId: ROUND_ID,
      roundIndex: 2,
      elapsedSecAtRound: 45,
      segmentIndex: 0,
    });
  });

  it('logRound parses duplicate_round without error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'duplicate_round' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await logRound({
      missionId: MISSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      roundIndex: 0,
      elapsedSecAtRound: 10,
      segmentIndex: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'duplicate_round' });
  });

  it('submitParticipantResult calls Edge Function with correct args and parses success', async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        participantId: PARTICIPANT_ID,
        segmentIndex: 0,
        partialReps: 15,
        repsPerRound: 40,
        finalScore: 302,
        scoreBreakdown: {
          baseScore: 175,
          pvi: 0,
          pviMultiplier: 1.15,
          domainWeight: 1.5,
          finalScore: 302,
        },
      },
      error: null,
    });

    const result = await submitParticipantResult({
      missionId: MISSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      partialReps: 15,
      segmentIndex: 0,
    });

    expect(invokeMock).toHaveBeenCalledWith('submit-participant-result', {
      body: {
        missionId: MISSION_ID,
        participantId: PARTICIPANT_ID,
        claimToken: 'claim-token',
        partialReps: 15,
        segmentIndex: 0,
      },
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      participantId: PARTICIPANT_ID,
      segmentIndex: 0,
      partialReps: 15,
      repsPerRound: 40,
      finalScore: 302,
      scoreBreakdown: {
        baseScore: 175,
        pvi: 0,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
      },
    });
  });

  it('treats score_already_locked as a recoverable success', async () => {
    invokeMock.mockResolvedValue({
      data: { ok: false, reason: 'score_already_locked' },
      error: null,
    });

    const result = await submitParticipantResult({
      missionId: MISSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      partialReps: 0,
      segmentIndex: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: false, reason: 'score_already_locked' });
  });

  it('maps ok:false reasons into an error message', async () => {
    invokeMock.mockResolvedValue({
      data: { ok: false, reason: 'rounds_unavailable' },
      error: null,
    });

    const result = await submitParticipantResult({
      missionId: MISSION_ID,
      participantId: PARTICIPANT_ID,
      claimToken: 'claim-token',
      partialReps: 0,
      segmentIndex: 0,
    });

    expect(result.data).toEqual({ ok: false, reason: 'rounds_unavailable' });
    expect(result.error?.message).toBe('Could not load your rounds. Please try again.');
  });

  it('setRallyPointCountdown calls RPC and parses ends_at', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        rally_point_countdown_ends_at: '2026-08-25T12:05:00.000Z',
      },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await setRallyPointCountdown({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
      seconds: 300,
    });

    expect(rpcMock).toHaveBeenCalledWith('set_rally_point_countdown', {
      p_mission_id: MISSION_ID,
      p_host_token: 'host-secret',
      p_seconds: 300,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      rallyPointCountdownEndsAt: '2026-08-25T12:05:00.000Z',
    });
  });

  it('setRallyPointCountdown maps invalid_seconds reason', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_seconds' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await setRallyPointCountdown({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
      seconds: 0,
    });

    expect(result.data).toEqual({ ok: false, reason: 'invalid_seconds' });
    expect(result.error?.message).toBe('Countdown must be between 1 and 600 seconds.');
  });

  it('cancelRallyPointCountdown calls RPC and returns ok', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await cancelRallyPointCountdown({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
    });

    expect(rpcMock).toHaveBeenCalledWith('cancel_rally_point_countdown', {
      p_mission_id: MISSION_ID,
      p_host_token: 'host-secret',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: true });
  });

  it('cancelRallyPointCountdown maps mission_not_waiting', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'mission_not_waiting' },
      error: null,
      success: true,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const result = await cancelRallyPointCountdown({
      missionId: MISSION_ID,
      hostToken: 'host-secret',
    });

    expect(result.data).toEqual({ ok: false, reason: 'mission_not_waiting' });
    expect(result.error?.message).toBe('Countdown can only run while the rally point is waiting.');
  });
});
