import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coachOnboardingStuckStatusLabel,
  fetchCoachActivationInactiveList,
  fetchCoachAnonSummary,
  fetchCoachDashboard,
  fetchCoachGuestList,
  fetchCoachGuestBrowsersSeries,
  fetchCoachChartNotesForRange,
  upsertCoachChartNote,
  fetchCoachOnlineNow,
  fetchCoachOnboardingStuckList,
  fetchCoachRecentEvents,
  fetchCoachUserDetail,
  fetchCoachUsersList,
  fetchCoachWaitingGraveyardList,
  parseCoachAnonSummary,
} from './coach';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const ANON_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

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
        activationFunnel: {
          signed_up: 12,
          identity_complete: 9,
          create_viewed: 7,
          mission_created: 6,
          mission_started: 4,
          finished: 3,
          claimed: 2,
          identity_rate_pct: 75,
          create_viewed_rate_pct: 77.78,
          mission_created_rate_pct: 85.71,
          mission_started_rate_pct: 66.67,
          finished_rate_pct: 75,
          claimed_rate_pct: 66.67,
        },
        waitingGraveyard: {
          waiting_or_setup: 11,
          older_than_2h: 5,
          older_than_24h: 2,
        },
        missionDropoff: [
          {
            bucket_order: 1,
            elapsed_bucket: 'First fifth (0-20%)',
            abandons: 9,
            pct_of_abandons: 60,
            median_elapsed_pct: 11.5,
            median_rounds: 1,
          },
        ],
        socialLift: [
          {
            cohort: 'solo',
            participations: 40,
            athletes: 20,
            completed: 16,
            completion_rate_pct: 40,
            return_eligible: 30,
            returned_within_14d: 9,
            return_rate_pct: 30,
            avg_group_size: 1,
          },
          {
            cohort: 'social',
            participations: 60,
            athletes: 25,
            completed: 39,
            completion_rate_pct: 65,
            return_eligible: 50,
            returned_within_14d: 30,
            return_rate_pct: 60,
            avg_group_size: 2.8,
          },
        ],
        acquisition: [
          {
            channel: 'organic_search',
            source: 'google.com',
            campaign: '—',
            browsers: 120,
            signed_up: 14,
            signup_rate_pct: 11.67,
            trained: 9,
            completed: 6,
            completion_rate_pct: 5,
          },
        ],
        contentPerformance: [
          {
            path: '/amrap-workouts/10',
            views: 300,
            entry_views: 210,
            visitors: 180,
            cta_clicks: 22,
            cta_rate_pct: 12.22,
            signed_up: 5,
          },
        ],
        contentEngagement: [
          {
            path: '/guides/what-is-amrap',
            sessions: 210,
            median_scroll_pct: 68.5,
            median_dwell_sec: 96,
            read_to_end: 44,
            bounced: 31,
            bounce_rate_pct: 14.76,
          },
        ],
        notFound: [{ path: '/old-workouts', referrer_host: 'reddit.com', hits: 12 }],
        ctaPlacement: [
          {
            cta: 'hero-plan',
            from_path: '/',
            to_path: '/create',
            clicks: 42,
            visitors: 31,
            signed_up: 7,
          },
        ],
        toolConversion: [
          {
            cohort_order: 1,
            cohort: 'reader_only',
            browsers: 400,
            cta_clicks: 30,
            signed_up: 8,
            signup_rate_pct: 2,
            trained: 6,
            completed_mission: 4,
            completed_rate_pct: 1,
          },
          {
            cohort_order: 3,
            cohort: 'timer_completed',
            browsers: 60,
            cta_clicks: 25,
            signed_up: 13,
            signup_rate_pct: 21.67,
            trained: 11,
            completed_mission: 9,
            completed_rate_pct: 15,
          },
        ],
        weeklyRetention: [
          {
            cohort_week: '2026-08-31',
            cohort_size: 10,
            week_offset: 1,
            retained: 4,
            retained_pct: 40,
          },
        ],
        missionAbandonment: {
          missions_finished: 20,
          missions_with_abandonment_event: 2,
          abandonment_rate_pct: 10,
        },
        signupFunnel: [
          {
            method: 'password',
            attempts: 20,
            completions: 14,
            awaiting_confirmation: 5,
            failures: 6,
            completion_rate_pct: 70,
          },
          {
            method: 'google',
            attempts: 8,
            completions: null,
            awaiting_confirmation: null,
            failures: 1,
            completion_rate_pct: null,
          },
        ],
        authFailureReasons: [
          { stage: 'sign_up', reason: 'duplicate', failure_count: 4, pct_of_failures: 57.14 },
        ],
        campaignFunnel: {
          campaigns_created: 12,
          campaigns_in_flight: 5,
          campaigns_concluded: 7,
          campaigns_started: 6,
          campaigns_reached_halfway: 4,
          campaigns_finished: 2,
          finish_rate_pct: 28.57,
          occurrence_adherence_pct: 61.9,
        },
        campaignLengthAdherence: [
          { week_count: 8, campaigns: 3, campaigns_finished: 1, occurrence_adherence_pct: 55 },
        ],
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

    expect(callRpcMock).toHaveBeenCalledWith('coach_dashboard', { p_window: 'all' });
    expect(result.error).toBeNull();
    expect(result.data?.topStrip.missionsCreated7d).toBe(3);
    expect(result.data?.topStrip.guestBrowsers7d).toBe(2);
    expect(result.data?.topStrip.uniqueAnonIds).toBe(5);
    expect(result.data?.claimFunnel.completionRatePct).toBe(40);
    expect(result.data?.activationFunnel.signedUp).toBe(12);
    expect(result.data?.activationFunnel.missionStarted).toBe(4);
    expect(result.data?.activationFunnel.finishedRatePct).toBe(75);
    expect(result.data?.waitingGraveyard.olderThan2h).toBe(5);
    expect(result.data?.templatePerformance[0]?.templateId).toBe('blood-shunt-5');
    expect(result.data?.signupFunnel[0]?.completions).toBe(14);
    expect(result.data?.authFailureReasons[0]?.reason).toBe('duplicate');
    expect(result.data?.campaignFunnel.campaignsInFlight).toBe(5);
    expect(result.data?.campaignLengthAdherence[0]?.weekCount).toBe(8);
    expect(result.data?.missionDropoff[0]?.medianElapsedPct).toBe(11.5);
    expect(result.data?.socialLift[1]?.completionRatePct).toBe(65);
    expect(result.data?.weeklyRetention[0]?.retainedPct).toBe(40);
    expect(result.data?.acquisition[0]?.channel).toBe('organic_search');
    expect(result.data?.contentPerformance[0]?.ctaRatePct).toBe(12.22);
    expect(result.data?.contentEngagement[0]?.medianDwellSec).toBe(96);
    expect(result.data?.notFound[0]?.referrerHost).toBe('reddit.com');
    expect(result.data?.ctaPlacement[0]?.cta).toBe('hero-plan');
    expect(result.data?.ctaPlacement[0]?.visitors).toBe(31);
    expect(result.data?.toolConversion[1]?.cohort).toBe('timer_completed');
    expect(result.data?.toolConversion[1]?.signupRatePct).toBe(21.67);
  });

  it('keeps an unobservable google completion null rather than zero', async () => {
    // A 0 here would read as "nobody ever completes Google sign-up"; the OAuth
    // redirect simply means the completion cannot be attributed to the attempt.
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        topStrip: {},
        claimFunnel: {},
        intakeFunnel: {},
        rallyConversion: {},
        missionAbandonment: {},
        signupFunnel: [
          {
            method: 'google',
            attempts: 8,
            completions: null,
            awaiting_confirmation: null,
            failures: 1,
            completion_rate_pct: null,
          },
        ],
        authFailureReasons: [],
        campaignFunnel: {},
        campaignLengthAdherence: [],
        templatePerformance: [],
        hostVsJoinerRetention: [],
        audioUnlockRate: [],
        rpcReliability: [],
        realtimeReliability: [],
      },
      error: null,
    });

    const result = await fetchCoachDashboard();

    expect(result.data?.signupFunnel[0]?.completions).toBeNull();
    expect(result.data?.signupFunnel[0]?.completionRatePct).toBeNull();
    expect(result.data?.signupFunnel[0]?.failures).toBe(1);
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
    expect(result.data?.signupFunnel).toEqual([]);
    expect(result.data?.missionDropoff).toEqual([]);
    expect(result.data?.socialLift).toEqual([]);
    expect(result.data?.weeklyRetention).toEqual([]);
    expect(result.data?.acquisition).toEqual([]);
    expect(result.data?.contentPerformance).toEqual([]);
    expect(result.data?.toolConversion).toEqual([]);
    expect(result.data?.ctaPlacement).toEqual([]);
    expect(result.data?.contentEngagement).toEqual([]);
    expect(result.data?.notFound).toEqual([]);
    expect(result.data?.campaignFunnel.campaignsCreated).toBe(0);
    expect(result.data?.campaignLengthAdherence).toEqual([]);
  });

  it('sends the requested window and echoes back the one the RPC used', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        window: '30d',
        topStrip: {},
        claimFunnel: {},
        intakeFunnel: {},
        rallyConversion: {},
        missionAbandonment: {},
        signupFunnel: [],
        authFailureReasons: [],
        campaignFunnel: {},
        campaignLengthAdherence: [],
        templatePerformance: [],
        hostVsJoinerRetention: [],
        audioUnlockRate: [],
        rpcReliability: [],
        realtimeReliability: [],
      },
      error: null,
    });

    const result = await fetchCoachDashboard('30d');

    expect(callRpcMock).toHaveBeenCalledWith('coach_dashboard', { p_window: '30d' });
    expect(result.data?.window).toBe('30d');
  });

  it('falls back to all time when the RPC echoes an unknown window', async () => {
    // An older deployed RPC returns no window key at all; the label must not
    // claim a scope the numbers were not computed with.
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        topStrip: {},
        claimFunnel: {},
        intakeFunnel: {},
        rallyConversion: {},
        missionAbandonment: {},
        signupFunnel: [],
        authFailureReasons: [],
        campaignFunnel: {},
        campaignLengthAdherence: [],
        templatePerformance: [],
        hostVsJoinerRetention: [],
        audioUnlockRate: [],
        rpcReliability: [],
        realtimeReliability: [],
      },
      error: null,
    });

    const result = await fetchCoachDashboard('90d');

    expect(result.data?.window).toBe('all');
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
      anonId: ANON_UUID,
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_events_recent', {
      p_event_name: 'mission_joined',
      p_limit: 50,
      p_user_id: null,
      p_anon_id: ANON_UUID,
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

describe('fetchCoachActivationInactiveList', () => {
  it('wires RPC params and parses inactive activation rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        users: [
          {
            user_id: '55555555-5555-4555-8555-555555555555',
            email: 'idle@example.com',
            username: 'idle_ops',
            nickname: 'Idle',
            missions_touched: 2,
            account_created_at: '2026-09-02T10:00:00.000Z',
            last_sign_in_at: '2026-09-03T10:00:00.000Z',
          },
          {
            user_id: 'bad-row',
            username: 'x',
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachActivationInactiveList({ limit: 25 });

    expect(callRpcMock).toHaveBeenCalledWith('coach_activation_inactive_list', {
      p_limit: 25,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        userId: '55555555-5555-4555-8555-555555555555',
        email: 'idle@example.com',
        username: 'idle_ops',
        nickname: 'Idle',
        missionsTouched: 2,
        accountCreatedAt: '2026-09-02T10:00:00.000Z',
        lastSignInAt: '2026-09-03T10:00:00.000Z',
      },
    ]);
  });
});

describe('fetchCoachWaitingGraveyardList', () => {
  it('wires RPC params and parses waiting graveyard rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        missions: [
          {
            mission_id: '66666666-6666-4666-8666-666666666666',
            state: 'waiting',
            created_at: '2026-09-01T08:00:00.000Z',
            workout_name: 'First contact',
            age_hours: 48.5,
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachWaitingGraveyardList();

    expect(callRpcMock).toHaveBeenCalledWith('coach_waiting_graveyard_list', {
      p_limit: 100,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        missionId: '66666666-6666-4666-8666-666666666666',
        state: 'waiting',
        createdAt: '2026-09-01T08:00:00.000Z',
        workoutName: 'First contact',
        ageHours: 48.5,
      },
    ]);
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
      acuteMinutes7d: 0,
      chronicWeeklyMinutes28d: 0,
      observedDays: 28,
    });
  });
});

describe('parseCoachAnonSummary', () => {
  it('parses an empty presence-only payload', () => {
    expect(
      parseCoachAnonSummary({
        ok: true,
        lastOccurredAt: null,
        lastRoute: null,
        eventCount: 0,
        eventNameCounts: {},
        linkedUserId: null,
        linkedNickname: null,
      })
    ).toEqual({
      lastOccurredAt: null,
      lastRoute: null,
      eventCount: 0,
      eventNameCounts: {},
      linkedUserId: null,
      linkedNickname: null,
    });
  });

  it('parses last activity and a linked account', () => {
    expect(
      parseCoachAnonSummary({
        ok: true,
        lastOccurredAt: '2026-09-03T12:00:00.000Z',
        lastRoute: '/mission/abc',
        eventCount: 4,
        eventNameCounts: { mission_joined: 2, page_viewed: 2 },
        linkedUserId: 'user-1',
        linkedNickname: 'Ghost',
      })
    ).toEqual({
      lastOccurredAt: '2026-09-03T12:00:00.000Z',
      lastRoute: '/mission/abc',
      eventCount: 4,
      eventNameCounts: { mission_joined: 2, page_viewed: 2 },
      linkedUserId: 'user-1',
      linkedNickname: 'Ghost',
    });
  });
});

describe('fetchCoachAnonSummary', () => {
  it('skips the RPC for an unlinkable anon id', async () => {
    const result = await fetchCoachAnonSummary('unknown');
    expect(callRpcMock).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('This browser id is not valid.');
  });

  it('wires p_anon_id and returns a parsed summary', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        lastOccurredAt: '2026-09-03T12:00:00.000Z',
        lastRoute: '/join',
        eventCount: 1,
        eventNameCounts: { mission_joined: 1 },
        linkedUserId: null,
        linkedNickname: null,
      },
      error: null,
    });

    const result = await fetchCoachAnonSummary(ANON_UUID);

    expect(callRpcMock).toHaveBeenCalledWith('coach_anon_summary', { p_anon_id: ANON_UUID });
    expect(result.error).toBeNull();
    expect(result.data?.eventCount).toBe(1);
    expect(result.data?.lastRoute).toBe('/join');
  });
});

describe('coach_anon_summary migration contract', () => {
  it('gates the dossier RPC and adds p_anon_id to coach_events_recent', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260903190000_coach_anon_summary.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_anon_summary');
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain('is_coach()');
    expect(sql).toContain('p_anon_id text DEFAULT NULL');
    expect(sql).toContain('AND (p_anon_id IS NULL OR ae.anon_id = p_anon_id)');
    expect(sql).toContain('analytics_events_anon_id_occurred_idx');
  });
});

describe('fetchCoachGuestList', () => {
  it('skips the RPC for a non-history bucket', async () => {
    const result = await fetchCoachGuestList({ activityBucket: 'all' });
    expect(callRpcMock).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Invalid activity bucket.');
  });

  it('wires RPC params and parses guest rows', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        guests: [
          { anon_id: ANON_UUID, last_occurred_at: '2026-09-03T12:00:00.000Z' },
          { anon_id: null, last_occurred_at: '2026-09-03T11:00:00.000Z' },
        ],
      },
      error: null,
    });

    const result = await fetchCoachGuestList({ activityBucket: 'last_24h', limit: 50 });

    expect(callRpcMock).toHaveBeenCalledWith('coach_guest_list', {
      p_activity_bucket: 'last_24h',
      p_limit: 50,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { anonId: ANON_UUID, lastOccurredAt: '2026-09-03T12:00:00.000Z' },
    ]);
  });
});

describe('coach_guest_list migration contract', () => {
  it('lists unlinked guests by last event in the four activity buckets', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260903200000_coach_guest_list.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_guest_list');
    expect(sql).toContain('is_coach()');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('analytics_identity_links');
    expect(sql).toContain("'last_24h'");
    expect(sql).toContain("'last_3d'");
    expect(sql).toContain("'last_7d'");
    expect(sql).toContain("'lapsed'");
    expect(sql).toContain('LEAST(GREATEST(coalesce(p_limit, 200), 1), 200)');
  });
});

describe('fetchCoachOnlineNow', () => {
  it('parses user and anon id arrays and drops empty values', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        userIds: ['user-1', '', 3],
        anonIds: [ANON_UUID, null],
      },
      error: null,
    });

    const result = await fetchCoachOnlineNow();

    expect(callRpcMock).toHaveBeenCalledWith('coach_online_now');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      userIds: ['user-1'],
      anonIds: [ANON_UUID],
    });
  });

  it('returns a generic error when ok is not true', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    const result = await fetchCoachOnlineNow();

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});

describe('coach_online_now migration contract', () => {
  it('windows presence_heartbeat for coach only and splits signed-in from guests', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260903210000_coach_online_now.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_online_now');
    expect(sql).toContain("event_name = 'presence_heartbeat'");
    expect(sql).toContain("interval '90 seconds'");
    expect(sql).toContain('is_coach()');
    expect(sql).toContain('ae.user_id IS NULL');
    expect(sql).toContain("ae.anon_id <> 'unknown'");
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.coach_online_now() FROM PUBLIC, anon');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.coach_online_now() TO authenticated');
  });
});

describe('fetchCoachGuestBrowsersSeries', () => {
  it('wires p_window and parses total plus points', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        window: '7d',
        grain: 'day',
        total: 53,
        points: [
          { bucketStart: '2026-09-01T00:00:00.000Z', count: 4 },
          { bucketStart: '2026-09-02T00:00:00.000Z', count: 0 },
          { bucketStart: null, count: 9 },
        ],
      },
      error: null,
    });

    const result = await fetchCoachGuestBrowsersSeries('7d');

    expect(callRpcMock).toHaveBeenCalledWith('coach_guest_browsers_series', { p_window: '7d' });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      window: '7d',
      grain: 'day',
      total: 53,
      points: [
        { bucketStart: '2026-09-01T00:00:00.000Z', count: 4 },
        { bucketStart: '2026-09-02T00:00:00.000Z', count: 0 },
      ],
    });
  });

  it('maps invalid_window from the RPC', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false, reason: 'invalid_window' },
      error: null,
    });

    const result = await fetchCoachGuestBrowsersSeries('7d');

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Invalid activity window.');
  });
});

describe('coach_guest_browsers_series migration contract', () => {
  it('indexes guest events and returns continuous window series for coach only', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260905120000_coach_guest_browsers_series.sql'),
      'utf8'
    );

    expect(sql).toContain('analytics_events_guest_occurred_anon_idx');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_guest_browsers_series');
    expect(sql).toContain('is_coach()');
    expect(sql).toContain('ae.user_id IS NULL');
    expect(sql).toContain("WHEN '24h' THEN");
    expect(sql).toContain("WHEN '3d' THEN");
    expect(sql).toContain("WHEN '7d' THEN");
    expect(sql).toContain("WHEN '30d' THEN");
    expect(sql).toContain("WHEN '90d' THEN");
    expect(sql).toContain("WHEN '365d' THEN");
    expect(sql).toContain("v_grain := 'hour'");
    expect(sql).toContain("v_grain := 'day'");
    expect(sql).toContain('generate_series');
    expect(sql).toContain("'bucketStart'");
    expect(sql).toContain("'invalid_window'");
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.coach_guest_browsers_series(text) FROM PUBLIC, anon'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.coach_guest_browsers_series(text) TO authenticated'
    );
  });

  it('aligns series buckets to exact window lengths', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260905140000_coach_guest_browsers_series_bucket_align.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_guest_browsers_series');
    expect(sql).toContain('v_bucket_count');
    expect(sql).toContain('v_series_start := v_series_end - (v_bucket_count - 1) * v_step');
    expect(sql).toContain('generate_series(v_series_start, v_series_end, v_step)');
  });
});

describe('fetchCoachChartNotesForRange', () => {
  it('wires range params and parses notes', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        notes: [
          {
            bucketStart: '2026-09-01T00:00:00.000Z',
            body: 'Launch spike',
            updatedAt: '2026-09-05T12:00:00.000Z',
            updatedBy: '11111111-1111-4111-8111-111111111111',
          },
          { bucketStart: null, body: 'skip' },
        ],
      },
      error: null,
    });

    const result = await fetchCoachChartNotesForRange({
      metric: 'guest_browsers',
      grain: 'day',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_chart_notes_for_range', {
      p_metric: 'guest_browsers',
      p_grain: 'day',
      p_from: '2026-09-01T00:00:00.000Z',
      p_to: '2026-09-30T00:00:00.000Z',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        bucketStart: '2026-09-01T00:00:00.000Z',
        body: 'Launch spike',
        updatedAt: '2026-09-05T12:00:00.000Z',
        updatedBy: '11111111-1111-4111-8111-111111111111',
      },
    ]);
  });
});

describe('upsertCoachChartNote', () => {
  it('returns the saved note on upsert', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        deleted: false,
        note: {
          bucketStart: '2026-09-01T00:00:00.000Z',
          body: 'Launch spike',
          updatedAt: '2026-09-05T12:00:00.000Z',
          updatedBy: '11111111-1111-4111-8111-111111111111',
        },
      },
      error: null,
    });

    const result = await upsertCoachChartNote({
      metric: 'guest_browsers',
      grain: 'day',
      bucketStart: '2026-09-01T00:00:00.000Z',
      body: 'Launch spike',
    });

    expect(callRpcMock).toHaveBeenCalledWith('coach_chart_note_upsert', {
      p_metric: 'guest_browsers',
      p_grain: 'day',
      p_bucket_start: '2026-09-01T00:00:00.000Z',
      p_body: 'Launch spike',
    });
    expect(result.error).toBeNull();
    expect(result.data?.deleted).toBe(false);
    expect(result.data?.note?.body).toBe('Launch spike');
  });

  it('returns deleted when the body is cleared', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: true, deleted: true },
      error: null,
    });

    const result = await upsertCoachChartNote({
      metric: 'guest_browsers',
      grain: 'day',
      bucketStart: '2026-09-01T00:00:00.000Z',
      body: '',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ deleted: true, note: null });
  });
});

describe('coach_chart_notes migration contract', () => {
  it('stores shared coach notes behind is_coach RPCs', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260905130000_coach_chart_notes.sql'),
      'utf8'
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.coach_chart_notes');
    expect(sql).toContain("metric = 'guest_browsers'");
    expect(sql).toContain("grain IN ('hour', 'day')");
    expect(sql).toContain('length(body) <= 500');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_chart_notes_for_range');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.coach_chart_note_upsert');
    expect(sql).toContain('is_coach()');
    expect(sql).toContain('ON CONFLICT (metric, grain, bucket_start) DO UPDATE');
    expect(sql).toContain("'deleted', true");
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.coach_chart_notes FROM PUBLIC, anon, authenticated'
    );
  });
});
