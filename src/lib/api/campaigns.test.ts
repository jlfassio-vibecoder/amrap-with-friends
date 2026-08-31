import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import * as missionIdentity from '@/lib/missionIdentity';
import {
  addSquadFriendToCampaign,
  createCampaign,
  fetchCampaignDetail,
  fetchCampaignInvitePreview,
  fetchMyCampaigns,
  joinCampaign,
  leaveCampaign,
  startCampaignMakeup,
} from './campaigns';
import type { PlannedCampaignOccurrence } from '@/lib/campaign';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  getSupabaseClient: vi.fn(),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/missionIdentity', () => ({
  persistMissionIdentity: vi.fn(),
  setStoredGhostSelection: vi.fn(),
}));

const rpcMock = vi.mocked(supabase.rpc);
const persistMock = vi.mocked(missionIdentity.persistMissionIdentity);
const ghostSeedMock = vi.mocked(missionIdentity.setStoredGhostSelection);

beforeEach(() => {
  rpcMock.mockReset();
  persistMock.mockReset();
  ghostSeedMock.mockReset();
});

function occurrence(sequence: number): PlannedCampaignOccurrence {
  return {
    sequence,
    weekNumber: 1,
    slotNumber: sequence,
    localDate: '2026-10-05',
    localTime: '06:30',
    weekday: 1,
    templateId: 'the-valve',
    workoutName: 'The Valve',
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    workout: [{ name: 'Air Squats', target: 10, unit: 'reps' }],
  };
}

describe('createCampaign', () => {
  it('sends snake_case occurrences the RPC expects', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        campaign_id: 'c1',
        invite_code: 'ABC123',
        total_missions: 2,
        missions_per_week: 2,
      },
      error: null,
    } as never);

    const result = await createCampaign({
      name: '  Winter Engine Build  ',
      goal: '  Eight rounds by week four.  ',
      weekCount: 4,
      startDate: '2026-10-05',
      occurrences: [occurrence(1), occurrence(2)],
    });

    expect(result.error).toBeNull();
    expect(result.data?.campaignId).toBe('c1');
    expect(result.data?.inviteCode).toBe('ABC123');

    const [, params] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(params.p_name).toBe('Winter Engine Build');
    expect(params.p_goal).toBe('Eight rounds by week four.');
    expect(params.p_week_count).toBe(4);
    expect(params.p_occurrences).toEqual([
      expect.objectContaining({
        sequence: 1,
        week_number: 1,
        slot_number: 1,
        local_date: '2026-10-05',
        local_time: '06:30',
        template_id: 'the-valve',
        duration_minutes: 10,
        intensity_tier: 3,
        workout: [{ name: 'Air Squats', target: 10, unit: 'reps' }],
      }),
      expect.objectContaining({ sequence: 2 }),
    ]);
  });

  it('sends a null goal when it is blank', async () => {
    rpcMock.mockResolvedValue({
      data: { campaign_id: 'c1', invite_code: 'ABC123' },
      error: null,
    } as never);
    await createCampaign({
      name: 'No goal',
      goal: '   ',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [occurrence(1)],
    });
    const [, params] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(params.p_goal).toBeNull();
  });

  it('rejects an empty name without calling the RPC', async () => {
    const result = await createCampaign({
      name: '   ',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [occurrence(1)],
    });
    expect(result.error?.message).toBe('Name your campaign.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects an empty schedule without calling the RPC', async () => {
    const result = await createCampaign({
      name: 'Empty',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [],
    });
    expect(result.error?.message).toBe('Build the campaign schedule first.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('translates the campaign cap into copy a host can act on', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign limit reached' },
    } as never);
    const result = await createCampaign({
      name: 'Fourth',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [occurrence(1)],
    });
    expect(result.error?.message).toBe(
      'You already have three campaigns running. Finish one first.'
    );
  });

  it('translates the intake gate', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Intake required' },
    } as never);
    const result = await createCampaign({
      name: 'No profile',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [occurrence(1)],
    });
    expect(result.error?.message).toBe('Complete your profile before starting a campaign.');
  });

  it('fails safe when the RPC returns an unusable row', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null } as never);
    const result = await createCampaign({
      name: 'Broken',
      weekCount: 2,
      startDate: '2026-10-05',
      occurrences: [occurrence(1)],
    });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Something went wrong. Please try again.');
  });
});

describe('fetchMyCampaigns', () => {
  it('parses summaries and keeps the host invite code', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        campaigns: [
          {
            campaign_id: 'c1',
            name: 'Winter Engine Build',
            goal: null,
            week_count: 4,
            missions_per_week: 2,
            start_date: '2026-10-05',
            timezone: 'America/Denver',
            status: 'active',
            role: 'host',
            invite_code: 'ABC123',
            total_missions: 8,
            completed_missions: 3,
            member_count: 4,
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchMyCampaigns();
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      campaignId: 'c1',
      role: 'host',
      inviteCode: 'ABC123',
      totalMissions: 8,
      completedMissions: 3,
      memberCount: 4,
    });
  });

  it('returns an empty list rather than throwing on an odd payload', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null } as never);
    const result = await fetchMyCampaigns();
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('drops rows missing an id instead of yielding a half-built campaign', async () => {
    rpcMock.mockResolvedValue({
      data: { campaigns: [{ name: 'Nameless' }, { campaign_id: 'c2', name: 'Real' }] },
      error: null,
    } as never);
    const result = await fetchMyCampaigns();
    expect(result.data.map((entry) => entry.campaignId)).toEqual(['c2']);
  });
});

describe('fetchCampaignDetail', () => {
  it('parses the campaign, calendar and roster', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        campaign: {
          campaign_id: 'c1',
          name: 'Winter Engine Build',
          goal: 'Eight rounds by week four.',
          week_count: 4,
          missions_per_week: 2,
          start_date: '2026-10-05',
          timezone: 'America/Denver',
          status: 'active',
          viewer_role: 'member',
          invite_code: null,
        },
        occurrences: [
          {
            occurrence_id: 'o1',
            sequence: 1,
            week_number: 1,
            slot_number: 1,
            local_date: '2026-10-05',
            local_time: '06:30:00',
            template_id: 'the-valve',
            duration_minutes: 10,
            intensity_tier: 3,
            workout: [{ name: 'Air Squats', target: 10 }],
            mission_id: null,
            status: 'planned',
          },
        ],
        members: [
          {
            user_id: 'u1',
            role: 'host',
            status: 'active',
            joined_at: '2026-09-01T00:00:00Z',
            nickname: 'Maya',
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchCampaignDetail('c1');
    expect(result.error).toBeNull();
    expect(result.data?.viewerRole).toBe('member');
    expect(result.data?.inviteCode).toBeNull();
    expect(result.data?.occurrences[0].occurrenceId).toBe('o1');
    expect(result.data?.members[0].nickname).toBe('Maya');
    expect(result.data?.makeups).toEqual([]);
  });

  it('trims the Postgres time to HH:MM for display', async () => {
    rpcMock.mockResolvedValue({
      data: {
        campaign: { campaign_id: 'c1', name: 'C' },
        occurrences: [{ occurrence_id: 'o1', local_time: '18:00:00' }],
        members: [],
      },
      error: null,
    } as never);
    const result = await fetchCampaignDetail('c1');
    expect(result.data?.occurrences[0].localTime).toBe('18:00');
  });

  it('maps the not-found error to copy that does not confirm the id exists', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign not found' },
    } as never);
    const result = await fetchCampaignDetail('missing');
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('That campaign is not available.');
  });
});

describe('fetchCampaignInvitePreview', () => {
  it('parses the preview a signed-out visitor sees', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        name: 'Winter Engine Build',
        goal: 'Eight rounds by week four.',
        week_count: 8,
        missions_per_week: 3,
        status: 'active',
        host_nickname: 'Maya',
        member_count: 4,
        member_limit: 50,
        first_mission_date: '2026-10-05',
        last_mission_date: '2026-11-27',
      },
      error: null,
    } as never);

    const result = await fetchCampaignInvitePreview('ABC123');
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      name: 'Winter Engine Build',
      hostNickname: 'Maya',
      memberCount: 4,
      memberLimit: 50,
    });
    const [name, params] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('campaign_invite_preview');
    expect(params.p_invite_code).toBe('ABC123');
  });

  it('rejects a blank code without calling the RPC', async () => {
    const result = await fetchCampaignInvitePreview('   ');
    expect(result.error?.message).toBe('That invite link is not valid.');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps an unknown code to copy that does not confirm what exists', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign not found' },
    } as never);
    const result = await fetchCampaignInvitePreview('NOPE');
    expect(result.error?.message).toBe('That campaign is not available.');
  });
});

describe('joinCampaign', () => {
  it('returns the campaign to navigate to', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, campaign_id: 'c1', name: 'Winter', already_member: false },
      error: null,
    } as never);
    const result = await joinCampaign('ABC123');
    expect(result.data).toEqual({ campaignId: 'c1', name: 'Winter', alreadyMember: false });
  });

  it('treats a repeat join as success, not an error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, campaign_id: 'c1', name: 'Winter', already_member: true },
      error: null,
    } as never);
    const result = await joinCampaign('ABC123');
    expect(result.error).toBeNull();
    expect(result.data?.alreadyMember).toBe(true);
  });

  it('explains a closed campaign', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign closed' },
    } as never);
    expect((await joinCampaign('ABC123')).error?.message).toBe(
      'This campaign has already finished.'
    );
  });

  it('explains a full campaign', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign full' },
    } as never);
    expect((await joinCampaign('ABC123')).error?.message).toBe('This campaign is full.');
  });
});

describe('addSquadFriendToCampaign', () => {
  it('sends the campaign and the athlete to the RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        campaign_id: 'c1',
        user_id: 'u2',
        nickname: 'Britt',
        already_member: false,
      },
      error: null,
    } as never);

    const result = await addSquadFriendToCampaign('c1', 'u2');

    expect(rpcMock).toHaveBeenCalledWith('add_squad_friend_to_campaign', {
      p_campaign_id: 'c1',
      p_user_id: 'u2',
    });
    expect(result.data).toEqual({ userId: 'u2', nickname: 'Britt', alreadyMember: false });
  });

  it('treats a repeat add as success, not an error', async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, campaign_id: 'c1', user_id: 'u2', nickname: 'Britt', already_member: true },
      error: null,
    } as never);

    const result = await addSquadFriendToCampaign('c1', 'u2');

    expect(result.error).toBeNull();
    expect(result.data?.alreadyMember).toBe(true);
  });

  it('refuses an empty pick without calling the RPC', async () => {
    const result = await addSquadFriendToCampaign('c1', '');

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.error?.message).toBe('Pick a squad friend to add.');
  });

  it('explains someone who is not a squad friend', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Pick a squad friend to add' },
    } as never);

    expect((await addSquadFriendToCampaign('c1', 'u2')).error?.message).toBe(
      'Pick a squad friend to add.'
    );
  });

  it('hides a campaign the caller does not host behind the not-found copy', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Campaign not found' },
    } as never);

    expect((await addSquadFriendToCampaign('c1', 'u2')).error?.message).toBe(
      'That campaign is not available.'
    );
  });
});

describe('leaveCampaign', () => {
  it('reports success', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null } as never);
    expect((await leaveCampaign('c1')).error).toBeNull();
  });

  it('explains why a host cannot leave', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Host cannot leave' },
    } as never);
    expect((await leaveCampaign('c1')).error?.message).toBe(
      'You are running this campaign, so you cannot leave it.'
    );
  });
});

describe('startCampaignMakeup', () => {
  it('persists identity and seeds the ghost pacer when a crewmate recording is returned', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        mission_id: 'makeup-sess',
        host_token: 'host-1',
        participant_id: 'part-1',
        claim_token: 'claim-1',
        nickname: 'Jules',
        pacer: {
          mission_id: 'live-sess',
          participant_id: 'crew-part',
          nickname: 'Maya',
          final_score: 120,
          base_score: 100,
          created_at: '2026-10-05T12:00:00.000Z',
        },
      },
      error: null,
    } as never);

    const result = await startCampaignMakeup('o1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ missionId: 'makeup-sess' });
    expect(rpcMock).toHaveBeenCalledWith('start_campaign_makeup', {
      p_occurrence_id: 'o1',
    });
    expect(persistMock).toHaveBeenCalledWith('makeup-sess', {
      nickname: 'Jules',
      participantId: 'part-1',
      hostToken: 'host-1',
      claimToken: 'claim-1',
    });
    expect(ghostSeedMock).toHaveBeenCalledWith(
      'makeup-sess',
      expect.objectContaining({
        missionId: 'live-sess',
        participantId: 'crew-part',
        nickname: 'Maya',
        finalScore: 120,
      })
    );
  });

  it('skips ghost seeding when no pacer is available', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        mission_id: 'makeup-sess',
        host_token: 'host-1',
        participant_id: 'part-1',
        claim_token: 'claim-1',
        nickname: 'Jules',
        pacer: null,
      },
      error: null,
    } as never);

    const result = await startCampaignMakeup('o1');
    expect(result.error).toBeNull();
    expect(persistMock).toHaveBeenCalled();
    expect(ghostSeedMock).not.toHaveBeenCalled();
  });

  it('maps Not next to make up', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not next to make up' },
    } as never);
    expect((await startCampaignMakeup('o2')).error?.message).toBe(
      'Make up the oldest mission you owe first.'
    );
  });
});
