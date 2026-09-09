import { beforeEach, describe, expect, it, vi } from 'vitest';

const callRpcMock = vi.fn();
vi.mock('@/lib/api/callRpc', () => ({ callRpc: callRpcMock }));

const { fetchCoachIdentityJourney } = await import('@/lib/api/coach');

describe('fetchCoachIdentityJourney', () => {
  beforeEach(() => {
    callRpcMock.mockReset();
  });

  it('sends both halves of the identity and parses a mixed timeline', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        identity: {
          userId: 'u1',
          anonIds: ['a1', 'a2'],
          nickname: 'Rook',
          accountCreatedAt: '2026-09-01T00:00:00Z',
          signedUpAt: '2026-09-02T00:00:00Z',
          firstSeenAt: '2026-08-30T00:00:00Z',
          lastSeenAt: '2026-09-05T00:00:00Z',
        },
        lifetime: {
          missionsHosted: 2,
          missionsJoined: 1,
          missionsTotal: 3,
          missionsCompleted: 2,
          missionsFinishedState: 3,
          bestScore: 512,
          totalWorkoutMinutes: 25,
          activeDays: 4,
        },
        eventCounts: { mission_created: 3, rally_link_copied: 1, bogus: 'nope' },
        timeline: [
          {
            at: '2026-09-05T10:00:00Z',
            kind: 'mission',
            payload: {
              missionId: 'm1',
              role: 'host',
              state: 'finished',
              templateId: 'blood-shunt',
              durationMinutes: 10,
              intensityTier: 3,
              finalScore: 512,
              completed: true,
              guest: false,
            },
          },
          {
            at: '2026-08-30T09:00:00Z',
            kind: 'event',
            payload: {
              eventName: 'mission_created',
              route: '/plan',
              missionId: 'm1',
              anonId: 'a1',
              signedIn: false,
              props: { duration_minutes: 10 },
            },
          },
        ],
      },
      error: null,
    });

    const result = await fetchCoachIdentityJourney({ userId: 'u1', anonId: 'a1' });

    expect(callRpcMock).toHaveBeenCalledWith('coach_identity_journey', {
      p_user_id: 'u1',
      p_anon_id: 'a1',
      p_limit: 300,
    });
    expect(result.data?.identity.anonIds).toEqual(['a1', 'a2']);
    expect(result.data?.lifetime.missionsCompleted).toBe(2);
    expect(result.data?.timeline).toHaveLength(2);
    expect(result.data?.timeline[0]?.kind).toBe('mission');
    // A non-numeric count is dropped rather than rendered as NaN.
    expect(result.data?.eventCounts).toEqual({ mission_created: 3, rally_link_copied: 1 });
  });

  it('accepts a guest with no account behind them', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        identity: { userId: null, anonIds: ['a9'] },
        lifetime: {},
        eventCounts: {},
        timeline: [],
      },
      error: null,
    });

    const result = await fetchCoachIdentityJourney({ anonId: 'a9' });

    expect(callRpcMock).toHaveBeenCalledWith('coach_identity_journey', {
      p_user_id: null,
      p_anon_id: 'a9',
      p_limit: 300,
    });
    expect(result.data?.identity.userId).toBeNull();
    expect(result.data?.lifetime.missionsTotal).toBe(0);
  });

  it('drops timeline rows with no timestamp instead of rendering an Invalid Date', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        ok: true,
        identity: {},
        lifetime: {},
        eventCounts: {},
        timeline: [{ kind: 'event', payload: { eventName: 'x' } }],
      },
      error: null,
    });

    const result = await fetchCoachIdentityJourney({ anonId: 'a9' });

    expect(result.data?.timeline).toEqual([]);
  });

  it('explains an identity-less call rather than showing a generic failure', async () => {
    callRpcMock.mockResolvedValue({
      data: { ok: false, reason: 'identity_required' },
      error: null,
    });

    const result = await fetchCoachIdentityJourney({});

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Pick a user or a guest to see their journey.');
  });

  it('maps the coach authorization error', async () => {
    callRpcMock.mockResolvedValue({ data: null, error: { message: 'Not authorized' } });
    const result = await fetchCoachIdentityJourney({ userId: 'u1' });
    expect(result.error?.message).toBe('Not authorized.');
  });
});
