import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startNextChainedMission, toMissionChainRpcItems } from './missionChain';
import { supabase } from '@/lib/supabase';
import * as missionIdentity from '@/lib/missionIdentity';
import * as rallyPointIdentity from '@/lib/rallyPointIdentity';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));
vi.mock('@/lib/missionIdentity', () => ({
  persistMissionIdentity: vi.fn(),
}));
vi.mock('@/lib/rallyPointIdentity', () => ({
  persistRallyPointIdentity: vi.fn(),
  getStoredRallyPointMemberId: vi.fn(() => 'member-1'),
  getStoredRallyPointNickname: vi.fn(() => 'Host'),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

const rpcMock = vi.mocked(supabase.rpc);

describe('toMissionChainRpcItems', () => {
  it('maps fields to snake_case and stamps started_mission_id on position 0 only', () => {
    expect(
      toMissionChainRpcItems([
        {
          durationMinutes: 10,
          workout: [{ name: 'Burpees', target: 10 }],
          templateId: 'the-piston',
          intensityTier: 3,
          startedMissionId: '11111111-1111-4111-8111-111111111111',
        },
        {
          durationMinutes: 5,
          workout: [{ name: 'Air Squats', target: 15 }],
          templateId: 'the-metronome',
          intensityTier: 3,
          startedMissionId: 'should-be-ignored',
        },
      ])
    ).toEqual([
      {
        duration_minutes: 10,
        workout: [{ name: 'Burpees', target: 10 }],
        template_id: 'the-piston',
        intensity_tier: 3,
        started_mission_id: '11111111-1111-4111-8111-111111111111',
      },
      {
        duration_minutes: 5,
        workout: [{ name: 'Air Squats', target: 15 }],
        template_id: 'the-metronome',
        intensity_tier: 3,
      },
    ]);
  });
});

describe('startNextChainedMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses success and persists identity', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        mission_id: '22222222-2222-4222-8222-222222222222',
        host_token: 'host',
        participant_id: 'p1',
        claim_token: 'claim',
        chain_position: 1,
        rest_seconds: 90,
        rest_ends_at: '2026-09-06T12:00:00.000Z',
        chain_remaining: 1,
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await startNextChainedMission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      complete: false,
      missionId: '22222222-2222-4222-8222-222222222222',
      hostToken: 'host',
      participantId: 'p1',
      claimToken: 'claim',
      chainPosition: 1,
      restSeconds: 90,
      restEndsAt: '2026-09-06T12:00:00.000Z',
      chainRemaining: 1,
    });
    expect(missionIdentity.persistMissionIdentity).toHaveBeenCalled();
    expect(rallyPointIdentity.persistRallyPointIdentity).toHaveBeenCalled();
  });

  it('maps chain_complete to complete: true', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: false, reason: 'chain_complete' },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as never);

    const result = await startNextChainedMission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ complete: true });
  });

  it('maps still-active RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Current mission is still active',
        name: 'PostgrestError',
        details: '',
        hint: '',
        code: 'P0001',
      },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as never);

    const result = await startNextChainedMission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Finish the current mission before starting the next one.');
  });
});
