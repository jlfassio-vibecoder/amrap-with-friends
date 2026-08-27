import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCoachDashboard,
  fetchCoachRecentEvents,
  fetchCoachUserDetail,
  fetchCoachUsersList,
} from './coach';

const callRpcMock = vi.fn();

vi.mock('@/lib/api/callRpc', () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}));

beforeEach(() => {
  callRpcMock.mockReset();
});

describe('fetchCoachDashboard', () => {
  it('maps a valid coach_dashboard payload', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        topStrip: {
          sessionsCreated7d: 3,
          sessionsCreated30d: 10,
          sessionsFinished7d: 2,
          sessionsFinished30d: 8,
          uniqueAnonIds: 5,
          registeredUsers: 4,
          practiceSessionsStarted: 1,
          liveSessionsCreated: 9,
        },
        claimFunnel: {
          prompts_shown: 10,
          claims_completed: 4,
          claims_conflicted: 1,
          completion_rate_pct: 40,
        },
        intakeFunnel: {
          submitted: 6,
          abandoned: 2,
          completion_rate_pct: 75,
        },
        rallyConversion: {
          links_copied: 8,
          deep_link_joins: 3,
          conversion_rate_pct: 37.5,
        },
        sessionAbandonment: {
          sessions_finished: 20,
          sessions_with_abandonment_event: 2,
          abandonment_rate_pct: 10,
        },
        templatePerformance: [
          {
            template_id: 'blood-shunt-5',
            intensity_tier: 3,
            duration_minutes: 5,
            sessions_created: 4,
            sessions_completed: 3,
            completion_rate_pct: 75,
          },
        ],
        hostVsJoinerRetention: [
          {
            first_role: 'host',
            user_count: 2,
            avg_sessions_per_user: 3.5,
            avg_active_days_per_user: 2,
          },
        ],
        audioUnlockRate: [
          {
            audio_context_state: 'running',
            unlock_count: 12,
            pct_of_unlocks: 80,
          },
        ],
        rpcReliability: [
          {
            rpc_name: 'join_session',
            call_count: 20,
            error_count: 1,
            error_rate_pct: 5,
            p50_latency_ms: 40,
            p95_latency_ms: 120,
          },
        ],
        realtimeReliability: [
          {
            status: 'SUBSCRIBED',
            event_count: 15,
            p50_subscribe_latency_ms: 250,
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachDashboard();

    expect(callRpcMock).toHaveBeenCalledWith('coach_dashboard');
    expect(result.error).toBeNull();
    expect(result.data?.topStrip.sessionsCreated7d).toBe(3);
    expect(result.data?.claimFunnel.completionRatePct).toBe(40);
    expect(result.data?.templatePerformance[0]?.templateId).toBe('blood-shunt-5');
  });

  it('maps Not authorized errors', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized' },
    });

    const result = await fetchCoachDashboard();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Not authorized.');
  });

  it('returns generic error when ok is false', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    const result = await fetchCoachDashboard();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});

describe('fetchCoachRecentEvents', () => {
  it('wires RPC params and parses event rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        events: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            event_name: 'session_joined',
            occurred_at: '2026-08-26T12:00:00.000Z',
            session_id: '22222222-2222-4222-8222-222222222222',
            participant_id: null,
            user_id: null,
            anon_id: 'anon-1',
            route: '/join',
            props: { deep_link: true },
          },
          {
            id: 'bad-row',
            event_name: null,
            occurred_at: '2026-08-26T11:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachRecentEvents({
      eventName: 'session_joined',
      limit: 50,
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_events_recent', {
      p_event_name: 'session_joined',
      p_limit: 50,
      p_user_id: null,
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].eventName).toBe('session_joined');
    expect(result.data?.[0].props).toEqual({ deep_link: true });
  });

  it('maps authentication errors', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Authentication required' },
    });

    const result = await fetchCoachRecentEvents({});

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to view the coach dashboard.');
  });
});

describe('fetchCoachUsersList', () => {
  it('wires RPC params and parses user rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        users: [
          {
            user_id: '11111111-1111-4111-8111-111111111111',
            username: 'ghost_ops',
            nickname: 'Ghost',
            email: 'ghost@example.com',
            perceived_classification: 'operator',
            account_created_at: '2026-08-26T10:00:00.000Z',
            last_active_at: '2026-08-26T12:00:00.000Z',
            total_sessions: 3,
          },
          {
            user_id: 'bad-row',
            username: null,
            email: null,
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachUsersList({ search: 'ghost', limit: 20 });

    expect(callRpcMock).toHaveBeenCalledWith('coach_users_list', {
      p_search: 'ghost',
      p_limit: 20,
      p_activity_bucket: null,
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].username).toBe('ghost_ops');
  });
});

describe('fetchCoachUserDetail', () => {
  it('wires RPC params and parses profile, summary, and nested rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        profile: {
          userId: '11111111-1111-4111-8111-111111111111',
          username: 'ghost_ops',
          nickname: 'Ghost',
          email: 'ghost@example.com',
          heightCm: 180,
          weightKg: 80,
          birthYear: 1990,
          biologicalSex: 'M',
          perceivedClassification: 'operator',
          accountCreatedAt: '2026-08-26T10:00:00.000Z',
        },
        summary: {
          sessionsAsHost: 2,
          sessionsAsJoiner: 1,
          totalSessions: 3,
          practiceSessionsStarted: 0,
          firstSeenAt: '2026-08-26T10:00:00.000Z',
          lastActiveAt: '2026-08-26T12:00:00.000Z',
        },
        classificationHistory: [
          {
            kind: 'perceived',
            previous_value: 'civilian',
            new_value: 'operator',
            occurred_at: '2026-08-26T11:00:00.000Z',
          },
        ],
        sessions: [
          {
            session_id: '22222222-2222-4222-8222-222222222222',
            role: 'host',
            template_id: 'blood-shunt-5',
            intensity_tier: 3,
            duration_minutes: 5,
            state: 'finished',
            final_score: 42,
            created_at: '2026-08-26T10:30:00.000Z',
            joined_at: '2026-08-26T10:30:00.000Z',
          },
        ],
        overtraining: {
          acuteLoad7d: 120,
          chronicWeeklyLoad28d: 60,
          consecutiveHighIntensityDays: 2,
        },
      },
      error: null,
    });

    const result = await fetchCoachUserDetail('11111111-1111-4111-8111-111111111111');

    expect(callRpcMock).toHaveBeenCalledWith('coach_user_detail', {
      p_user_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.error).toBeNull();
    expect(result.data?.profile.nickname).toBe('Ghost');
    expect(result.data?.summary.totalSessions).toBe(3);
    expect(result.data?.classificationHistory).toHaveLength(1);
    expect(result.data?.sessions[0]?.finalScore).toBe(42);
    expect(result.data?.overtraining).toEqual({
      acuteLoad7d: 120,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 2,
    });
  });
});
