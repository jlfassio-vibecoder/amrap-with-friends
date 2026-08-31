import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announceNextMission,
  createRallyPointSession,
  getRallyPoint,
  joinRallyPoint,
  leaveRallyPoint,
  passRallyPointCommand,
  startNextRallyPointSession,
} from './rallyPoint';
import { supabase } from '@/lib/supabase';
import * as sessionIdentity from '@/lib/sessionIdentity';
import * as rallyPointIdentity from '@/lib/rallyPointIdentity';
import { track } from '@/lib/analytics/track';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock('@/lib/sessionIdentity', () => ({
  persistSessionIdentity: vi.fn(),
  clearStoredHostToken: vi.fn(),
}));
vi.mock('@/lib/rallyPointIdentity', () => ({
  persistRallyPointIdentity: vi.fn(),
  getStoredRallyPointMemberId: vi.fn(() => 'member-1'),
  getStoredRallyPointNickname: vi.fn(() => 'Host'),
  getStoredRallyPointSeatClaim: vi.fn(() => 'seat-secret'),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const trackMock = vi.mocked(track);

const rpcMock = vi.mocked(supabase.rpc);

const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

describe('rally point API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRallyPointSession persists rallyPoint and session identity', async () => {
    rpcMock.mockResolvedValue({
      data: {
        rally_point_id: RALLY_POINT_ID,
        rally_point_member_id: MEMBER_ID,
        session_id: SESSION_ID,
        host_token: 'host-secret',
        participant_id: PARTICIPANT_ID,
        claim_token: 'claim-1',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await createRallyPointSession({
      nickname: 'Host',
      durationMinutes: 12,
      workout: [{ name: 'Burpees', target: 10 }],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'create_rally_point_session',
      expect.objectContaining({
        p_duration_minutes: 12,
        p_nickname: 'Host',
      })
    );
    expect(rallyPointIdentity.persistRallyPointIdentity).toHaveBeenCalledWith(RALLY_POINT_ID, {
      memberId: MEMBER_ID,
      nickname: 'Host',
      sessionId: SESSION_ID,
    });
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.data?.rallyPointId).toBe(RALLY_POINT_ID);
  });

  it('joinRallyPoint maps not-found errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Rally point not found' },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as never);

    const result = await joinRallyPoint({ rallyPointId: RALLY_POINT_ID, nickname: 'Jules' });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Rally point not found.');
  });

  it('joinRallyPoint persists rotated claim_token and session_state on reclaim', async () => {
    rpcMock.mockResolvedValue({
      data: {
        rally_point_id: RALLY_POINT_ID,
        rally_point_member_id: MEMBER_ID,
        host_user_id: 'user-1',
        status: 'open',
        active_session_id: SESSION_ID,
        session_id: SESSION_ID,
        session_state: 'waiting',
        participant_id: PARTICIPANT_ID,
        nickname: 'Jules',
        role: 'joiner',
        claim_token: 'rotated-claim',
        host_token: null,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await joinRallyPoint({ rallyPointId: RALLY_POINT_ID, nickname: 'Jules' });
    expect(result.error).toBeNull();
    expect(result.data?.sessionState).toBe('waiting');
    expect(result.data?.claimToken).toBe('rotated-claim');
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        participantId: PARTICIPANT_ID,
        claimToken: 'rotated-claim',
      })
    );
  });

  it('passRallyPointCommand returns null host_token and clears the old host token', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        host_user_id: 'user-2',
        host_token: null,
        active_session_id: SESSION_ID,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await passRallyPointCommand({
      rallyPointId: RALLY_POINT_ID,
      toUserId: 'user-2',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      hostUserId: 'user-2',
      hostToken: null,
      activeSessionId: SESSION_ID,
    });
    expect(sessionIdentity.clearStoredHostToken).toHaveBeenCalledWith(SESSION_ID);
  });

  it('leaveRallyPoint tracks rally_point_closed when the last host leaves', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, rally_point_id: RALLY_POINT_ID, left: true, closed: true },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await leaveRallyPoint(RALLY_POINT_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ left: true, closed: true });
    expect(trackMock).toHaveBeenCalledWith('rally_point_closed', {});
    expect(trackMock).not.toHaveBeenCalledWith('rally_point_host_reassigned', {});
  });

  it('leaveRallyPoint tracks rally_point_host_reassigned when host leaves a successor', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        rally_point_id: RALLY_POINT_ID,
        left: true,
        was_host: true,
        host_user_id: 'user-2',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await leaveRallyPoint(RALLY_POINT_ID);
    expect(result.error).toBeNull();
    expect(result.data?.left).toBe(true);
    expect(trackMock).toHaveBeenCalledWith('rally_point_host_reassigned', {});
    expect(trackMock).not.toHaveBeenCalledWith('rally_point_closed', {});
  });

  it('startNextRallyPointSession seeds the new session identity', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        session_id: SESSION_ID,
        host_token: 'next-host',
        participant_id: PARTICIPANT_ID,
        claim_token: 'next-claim',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await startNextRallyPointSession({
      rallyPointId: RALLY_POINT_ID,
      durationMinutes: 10,
      workout: [{ name: 'Air Squats', target: 15 }],
      templateId: 'blood-shunt-10',
      intensityTier: 3,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'start_next_rally_point_session',
      expect.objectContaining({
        p_template_id: 'blood-shunt-10',
        p_intensity_tier: 3,
      })
    );
    expect(result.error).toBeNull();
    expect(result.data?.sessionId).toBe(SESSION_ID);
    expect(sessionIdentity.persistSessionIdentity).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        hostToken: 'next-host',
        participantId: PARTICIPANT_ID,
        claimToken: 'next-claim',
      })
    );
  });

  describe('joinRallyPoint guest seat', () => {
    function joinOk() {
      rpcMock.mockResolvedValue({
        data: {
          rally_point_id: RALLY_POINT_ID,
          rally_point_member_id: MEMBER_ID,
          host_user_id: 'user-1',
          status: 'open',
          active_session_id: SESSION_ID,
          session_id: SESSION_ID,
          session_state: 'waiting',
          participant_id: PARTICIPANT_ID,
          nickname: 'Guesty',
          role: 'joiner',
          claim_token: 'claim',
          host_token: null,
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as never);
    }

    it('hands the stored member id back so a guest reclaims its seat', async () => {
      vi.mocked(rallyPointIdentity.getStoredRallyPointMemberId).mockReturnValue(MEMBER_ID);
      vi.mocked(rallyPointIdentity.getStoredRallyPointSeatClaim).mockReturnValue('seat-secret');
      joinOk();

      await joinRallyPoint({ rallyPointId: RALLY_POINT_ID, nickname: 'Guesty' });

      expect(rpcMock).toHaveBeenCalledWith('join_rally_point', {
        p_rally_point_id: RALLY_POINT_ID,
        p_nickname: 'Guesty',
        p_rally_point_member_id: MEMBER_ID,
        p_seat_claim: 'seat-secret',
      });
    });

    it('sends null on a first visit, so a new guest gets a fresh seat', async () => {
      vi.mocked(rallyPointIdentity.getStoredRallyPointMemberId).mockReturnValue(null);
      vi.mocked(rallyPointIdentity.getStoredRallyPointSeatClaim).mockReturnValue(null);
      joinOk();

      await joinRallyPoint({ rallyPointId: RALLY_POINT_ID, nickname: 'Newcomer' });

      expect(rpcMock).toHaveBeenCalledWith('join_rally_point', {
        p_rally_point_id: RALLY_POINT_ID,
        p_nickname: 'Newcomer',
        p_rally_point_member_id: null,
        p_seat_claim: null,
      });
    });

    it('lets an explicit null override the stored id', async () => {
      vi.mocked(rallyPointIdentity.getStoredRallyPointMemberId).mockReturnValue(MEMBER_ID);
      joinOk();

      await joinRallyPoint({
        rallyPointId: RALLY_POINT_ID,
        nickname: 'Guesty',
        rallyPointMemberId: null,
      });

      expect(rpcMock).toHaveBeenCalledWith(
        'join_rally_point',
        expect.objectContaining({ p_rally_point_member_id: null, p_seat_claim: null })
      );
    });
  });

  describe('leaveRallyPoint guest seat', () => {
    function leaveOk() {
      rpcMock.mockResolvedValue({
        data: { ok: true, rally_point_id: RALLY_POINT_ID, left: true },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as never);
    }

    it('hands the stored member id back so a guest can leave', async () => {
      vi.mocked(rallyPointIdentity.getStoredRallyPointMemberId).mockReturnValue(MEMBER_ID);
      vi.mocked(rallyPointIdentity.getStoredRallyPointSeatClaim).mockReturnValue('seat-secret');
      leaveOk();

      await leaveRallyPoint(RALLY_POINT_ID);

      expect(rpcMock).toHaveBeenCalledWith('leave_rally_point', {
        p_rally_point_id: RALLY_POINT_ID,
        p_rally_point_member_id: MEMBER_ID,
        p_seat_claim: 'seat-secret',
      });
    });

    it('sends null when there is no stored seat', async () => {
      vi.mocked(rallyPointIdentity.getStoredRallyPointMemberId).mockReturnValue(null);
      vi.mocked(rallyPointIdentity.getStoredRallyPointSeatClaim).mockReturnValue(null);
      leaveOk();

      await leaveRallyPoint(RALLY_POINT_ID);

      expect(rpcMock).toHaveBeenCalledWith(
        'leave_rally_point',
        expect.objectContaining({ p_rally_point_member_id: null, p_seat_claim: null })
      );
    });

    it('reports a refusal instead of pretending the seat was released', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'Rally point not found' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      } as never);

      const result = await leaveRallyPoint(RALLY_POINT_ID);

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });

  describe('announceNextMission', () => {
    it('calls the announce RPC', async () => {
      rpcMock.mockResolvedValue({
        data: {
          ok: true,
          rally_point_id: RALLY_POINT_ID,
          next_mission_pending_at: '2026-09-01T12:00:00Z',
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as never);

      const result = await announceNextMission(RALLY_POINT_ID);

      expect(rpcMock).toHaveBeenCalledWith('announce_next_mission', {
        p_rally_point_id: RALLY_POINT_ID,
      });
      expect(result.error).toBeNull();
      expect(result.data?.nextMissionPendingAt).toBe('2026-09-01T12:00:00Z');
    });
  });

  describe('getRallyPoint', () => {
    it('parses next_mission_pending_at', async () => {
      rpcMock.mockResolvedValue({
        data: {
          ok: true,
          rally_point_id: RALLY_POINT_ID,
          host_user_id: 'user-1',
          active_session_id: SESSION_ID,
          active_session_state: 'finished',
          status: 'open',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T11:00:00Z',
          next_mission_pending_at: '2026-09-01T12:00:00Z',
          members: [],
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      } as never);

      const result = await getRallyPoint(RALLY_POINT_ID);

      expect(result.error).toBeNull();
      expect(result.data?.nextMissionPendingAt).toBe('2026-09-01T12:00:00Z');
    });
  });
});
