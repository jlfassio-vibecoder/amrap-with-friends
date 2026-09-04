import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coachOnboardingStuckStatusLabel,
  fetchCoachDashboard,
  fetchCoachOnboardingStuckList,
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
          missionsCreated7d: 3,
          missionsCreated30d: 10,
          missionsFinished7d: 2,
          missionsFinished30d: 8,
          guestBrowsers7d: 2,
          uniqueAnonIds: 5,
          registeredUsers: 4,
          practiceMissionsStarted: 1,
          liveMissionsCreated: 9,
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
        missionAbandonment: {
          missions_finished: 20,
          missions_with_abandonment_event: 2,
          abandonment_rate_pct: 10,
        },
        templatePerformance: [
          {
            template_id: 'blood-shunt-5',
            intensity_tier: 3,
            duration_minutes: 5,
            missions_created: 4,
            missions_completed: 3,
            completion_rate_pct: 75,
          },
        ],
        hostVsJoinerRetention: [
          {
            first_role: 'host',
            user_count: 2,
            avg_missions_per_user: 3.5,
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
            rpc_name: 'join_mission',
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
    expect(result.data?.topStrip.missionsCreated7d).toBe(3);
    expect(result.data?.topStrip.guestBrowsers7d).toBe(2);
    expect(result.data?.topStrip.uniqueAnonIds).toBe(5);
    expect(result.data?.claimFunnel.completionRatePct).toBe(40);
    expect(result.data?.templatePerformance[0]?.templateId).toBe('blood-shunt-5');
  });

  it('treats a missing guestBrowsers7d key as zero (old RPC)', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        topStrip: {
          missionsCreated7d: 3,
          missionsCreated30d: 10,
          missionsFinished7d: 2,
          missionsFinished30d: 8,
          uniqueAnonIds: 5,
          registeredUsers: 4,
          practiceMissionsStarted: 1,
          liveMissionsCreated: 9,
        },
        claimFunnel: {},
        intakeFunnel: {},
        rallyConversion: {},
        missionAbandonment: {},
        templatePerformance: [],
        hostVsJoinerRetention: [],
        audioUnlockRate: [],
        rpcReliability: [],
        realtimeReliability: [],
      },
      error: null,
    });

    const result = await fetchCoachDashboard();

    expect(result.error).toBeNull();
    expect(result.data?.topStrip.guestBrowsers7d).toBe(0);
    expect(result.data?.topStrip.uniqueAnonIds).toBe(5);
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
            event_name: 'mission_joined',
            occurred_at: '2026-08-26T12:00:00.000Z',
            mission_id: '22222222-2222-4222-8222-222222222222',
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
      eventName: 'mission_joined',
      limit: 50,
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_events_recent', {
      p_event_name: 'mission_joined',
      p_limit: 50,
      p_user_id: null,
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].eventName).toBe('mission_joined');
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
            total_missions: 3,
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

describe('coachOnboardingStuckStatusLabel', () => {
  it('returns plain-English labels for stuck statuses', () => {
    expect(coachOnboardingStuckStatusLabel('needs_profile')).toBe(
      'Signed up — profile not started'
    );
    expect(coachOnboardingStuckStatusLabel('intake_incomplete')).toBe(
      'Profile started — finish your details'
    );
  });
});

describe('fetchCoachOnboardingStuckList', () => {
  it('wires RPC params and parses stuck onboarding rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        users: [
          {
            user_id: '22222222-2222-4222-8222-222222222222',
            email: 'stuck@example.com',
            status: 'needs_profile',
            account_created_at: '2026-09-01T10:00:00.000Z',
            last_sign_in_at: '2026-09-01T10:05:00.000Z',
            providers: ['email', 'google'],
          },
          {
            user_id: '33333333-3333-4333-8333-333333333333',
            email: 'partial@example.com',
            status: 'intake_incomplete',
            account_created_at: '2026-09-01T11:00:00.000Z',
            last_sign_in_at: null,
            providers: [],
          },
          {
            user_id: 'bad-row',
            email: null,
            status: 'needs_profile',
          },
          {
            user_id: '44444444-4444-4444-8444-444444444444',
            email: 'weird@example.com',
            status: 'unknown_status',
            account_created_at: '2026-09-01T12:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachOnboardingStuckList({ limit: 50 });

    expect(callRpcMock).toHaveBeenCalledWith('coach_onboarding_stuck_list', {
      p_limit: 50,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        userId: '22222222-2222-4222-8222-222222222222',
        email: 'stuck@example.com',
        status: 'needs_profile',
        accountCreatedAt: '2026-09-01T10:00:00.000Z',
        lastSignInAt: '2026-09-01T10:05:00.000Z',
        providers: ['email', 'google'],
      },
      {
        userId: '33333333-3333-4333-8333-333333333333',
        email: 'partial@example.com',
        status: 'intake_incomplete',
        accountCreatedAt: '2026-09-01T11:00:00.000Z',
        lastSignInAt: null,
        providers: [],
      },
    ]);
  });

  it('maps auth errors for the stuck list', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized' },
    });

    const result = await fetchCoachOnboardingStuckList();

    expect(callRpcMock).toHaveBeenCalledWith('coach_onboarding_stuck_list', {
      p_limit: 100,
    });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Not authorized.');
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
          missionsAsHost: 2,
          missionsAsJoiner: 1,
          totalMissions: 3,
          practiceMissionsStarted: 0,
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
        missions: [
          {
            mission_id: '22222222-2222-4222-8222-222222222222',
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
    expect(result.data?.summary.totalMissions).toBe(3);
    expect(result.data?.classificationHistory).toHaveLength(1);
    expect(result.data?.missions[0]?.finalScore).toBe(42);
    expect(result.data?.overtraining).toEqual({
      acuteLoad7d: 120,
      chronicWeeklyLoad28d: 60,
      consecutiveHighIntensityDays: 2,
    });
  });
});
