import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import MyMissionsPage from './MyMissionsPage';
import type { CampaignSummary } from '@/lib/api/campaigns';
import type { MyMissionEntry } from '@/lib/api/myMissions';

const fetchMyMissionsMock = vi.fn();
const fetchMyMissionDetailMock = vi.fn();
const deleteIncompleteMissionMock = vi.fn();
const fetchMyCampaignsMock = vi.fn();
const fetchMyInvitationsMock = vi.fn();
const fetchInvitationUnreadCountMock = vi.fn();
const markInvitationsReadMock = vi.fn();
const createRallyPointMissionMock = vi.fn();
const fetchHostActiveMissionCountMock = vi.fn();
const navigateMock = vi.fn();
const authUser = { id: 'user-1' };
const athleteProfileState = {
  profile: { nickname: 'Justin' } as { nickname: string } | null,
  loading: false,
  error: null as string | null,
};

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: authUser,
  }),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => athleteProfileState,
}));

vi.mock('@/lib/api/myMissions', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/myMissions')>('@/lib/api/myMissions');
  return {
    ...actual,
    fetchMyMissions: (...args: unknown[]) => fetchMyMissionsMock(...args),
    fetchMyMissionDetail: (...args: unknown[]) => fetchMyMissionDetailMock(...args),
    deleteIncompleteMission: (...args: unknown[]) => deleteIncompleteMissionMock(...args),
  };
});

vi.mock('@/lib/api/campaigns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/campaigns')>('@/lib/api/campaigns');
  return {
    ...actual,
    fetchMyCampaigns: (...args: unknown[]) => fetchMyCampaignsMock(...args),
  };
});

vi.mock('@/lib/api/invitations', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/invitations')>('@/lib/api/invitations');
  return {
    ...actual,
    fetchMyInvitations: (...args: unknown[]) => fetchMyInvitationsMock(...args),
    fetchInvitationUnreadCount: (...args: unknown[]) => fetchInvitationUnreadCountMock(...args),
    markInvitationsRead: (...args: unknown[]) => markInvitationsReadMock(...args),
  };
});

vi.mock('@/lib/api/rallyPoint', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/rallyPoint')>('@/lib/api/rallyPoint');
  return {
    ...actual,
    createRallyPointMission: (...args: unknown[]) => createRallyPointMissionMock(...args),
  };
});

vi.mock('@/lib/api/missions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/missions')>('@/lib/api/missions');
  return {
    ...actual,
    fetchHostActiveMissionCount: (...args: unknown[]) => fetchHostActiveMissionCountMock(...args),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function entry(overrides: Partial<MyMissionEntry> = {}): MyMissionEntry {
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
    workout: [{ name: 'Mountain Climbers', target: 20, unit: 'reps' }],
    movementCount: 1,
    repsPerRound: 20,
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

function campaign(overrides: Partial<CampaignSummary> = {}): CampaignSummary {
  return {
    campaignId: '33333333-3333-4333-8333-333333333333',
    name: 'Spring Build',
    goal: null,
    weekCount: 8,
    missionsPerWeek: 3,
    startDate: '2026-09-01',
    timezone: 'America/Los_Angeles',
    status: 'active',
    role: 'host',
    inviteCode: 'ABC123',
    totalMissions: 24,
    completedMissions: 2,
    memberCount: 3,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  fetchMyMissionsMock.mockReset();
  fetchMyMissionDetailMock.mockReset();
  deleteIncompleteMissionMock.mockReset();
  fetchMyCampaignsMock.mockReset();
  fetchMyInvitationsMock.mockReset();
  fetchInvitationUnreadCountMock.mockReset();
  markInvitationsReadMock.mockReset();
  createRallyPointMissionMock.mockReset();
  fetchHostActiveMissionCountMock.mockReset();
  navigateMock.mockReset();
  athleteProfileState.profile = { nickname: 'Justin' };
  athleteProfileState.loading = false;
  athleteProfileState.error = null;
  vi.unstubAllGlobals();
});

function renderPage() {
  if (!fetchMyCampaignsMock.getMockImplementation()) {
    fetchMyCampaignsMock.mockResolvedValue({ data: [], error: null });
  }
  if (!fetchMyInvitationsMock.getMockImplementation()) {
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [],
      resolved: [],
      unreadCount: 0,
      error: null,
    });
  }
  if (!fetchInvitationUnreadCountMock.getMockImplementation()) {
    fetchInvitationUnreadCountMock.mockResolvedValue({ unreadCount: 0, error: null });
  }
  if (!markInvitationsReadMock.getMockImplementation()) {
    markInvitationsReadMock.mockResolvedValue({ error: null });
  }
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MyMissionsPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('MyMissionsPage workout summary', () => {
  it('centers the coach workout name and lists movements under a disclosure', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          coachWorkoutName: 'Crimp Conditioning',
          workout: [
            { name: 'Dead Hang', target: 30, unit: 'seconds' },
            { name: 'Pull-ups', target: 10, unit: 'reps' },
          ],
          movementCount: 2,
          repsPerRound: 40,
          state: 'finished',
          finalScore: 42,
        }),
      ],
      chains: {},
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Crimp Conditioning')).toBeTruthy();
    });
    expect(screen.getByText('2 movements')).toBeTruthy();
    expect(screen.getByText('Dead Hang — 30 seconds')).toBeTruthy();
    expect(screen.getByText('Pull-ups — 10 reps')).toBeTruthy();
  });

  it('resolves a library template name when there is no coach name', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          templateId: 'the-pendulum',
          workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
          movementCount: 1,
          repsPerRound: 10,
        }),
      ],
      chains: {},
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('The Pendulum')).toBeTruthy();
    });
    expect(screen.getByText('1 movement')).toBeTruthy();
  });
});

describe('MyMissionsPage delete', () => {
  it('shows Delete only for incomplete host rows', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({ participantId: 'p1', missionId: 's1' }),
        entry({
          participantId: 'p2',
          missionId: 's2',
          role: 'joiner',
        }),
        entry({
          participantId: 'p3',
          missionId: 's3',
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
        }),
        entry({
          participantId: 'p4',
          missionId: 's4',
          state: 'finished',
          roundCount: 6,
        }),
      ],
      chains: {},
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Start this mission')).toHaveLength(1);
      expect(screen.getAllByText('Enter mission')).toHaveLength(1);
      expect(screen.getAllByText('View mission')).toHaveLength(2);
    });

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    // Incomplete host gets Delete; Re-launch only on the three non-deletable rows.
    expect(screen.getAllByRole('button', { name: 'Re-launch mission' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'View breakdown' })).toBeTruthy();
  });

  it('confirms then deletes and reloads the list', async () => {
    fetchMyMissionsMock
      .mockResolvedValueOnce({
        data: [entry()],
        chains: {},
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        chains: {},
        error: null,
      });
    deleteIncompleteMissionMock.mockImplementation(async () => ({ error: null }));
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal('confirm', confirmMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(deleteIncompleteMissionMock).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222'
      );
      expect(fetchMyMissionsMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      expect(screen.getByText(/No saved missions yet/)).toBeTruthy();
    });
  });

  it('confirms featured delete as a single date/time cancel', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          isFeatured: true,
          scheduledAt: '2026-09-05T16:45:00.000Z',
          coachWorkoutName: 'THE UNDERTOW',
        }),
      ],
      chains: {},
      error: null,
    });
    deleteIncompleteMissionMock.mockImplementation(async () => ({ error: null }));
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal('confirm', confirmMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Featured/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringMatching(/Cancel today's mission for this date and time only/i)
    );
    const message = String(confirmMock.mock.calls[0]?.[0] ?? '');
    expect(message).not.toMatch(/WOD/i);
  });
});

describe('MyMissionsPage chain groups', () => {
  it('expands a planned chain to show queued mission cards in order', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          templateId: 'the-piston',
          rallyPointId: 'rp1',
          workout: [{ name: 'Air Squats', target: 10 }],
          movementCount: 1,
          repsPerRound: 10,
        }),
      ],
      chains: {
        rp1: [
          {
            id: 'c0',
            position: 0,
            durationMinutes: 5,
            workout: [],
            templateId: 'the-piston',
            intensityTier: 3,
            startedMissionId: '22222222-2222-4222-8222-222222222222',
          },
          {
            id: 'c1',
            position: 1,
            durationMinutes: 5,
            workout: [{ name: 'Fast Air Squats', target: 15 }],
            templateId: 'the-metronome',
            intensityTier: 3,
            startedMissionId: null,
          },
          {
            id: 'c2',
            position: 2,
            durationMinutes: 10,
            workout: [{ name: 'Burpees', target: 10 }],
            templateId: 'whiplash',
            intensityTier: 3,
            startedMissionId: null,
          },
        ],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('The Piston')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Show chained missions' })).toBeTruthy();
    });
    expect(screen.getByText(/1 of 3 in this chain/)).toBeTruthy();
    expect(screen.queryByText('The Metronome')).toBeNull();
    expect(screen.queryByText('Whiplash')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show chained missions' }));

    expect(screen.getByText('The Metronome')).toBeTruthy();
    expect(screen.getByText('Whiplash')).toBeTruthy();
    expect(screen.getAllByText(/queued/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Hide chained missions' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide chained missions' }));
    expect(screen.queryByText('The Metronome')).toBeNull();
  });

  it('collapses daisy siblings and expands to reveal the older mission', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          participantId: 'p-new',
          missionId: 'm-new',
          createdAt: '2026-09-06T10:00:00.000Z',
          rallyPointId: 'rp1',
          templateId: 'the-piston',
          workout: [{ name: 'Air Squats', target: 10 }],
          movementCount: 1,
          repsPerRound: 10,
        }),
        entry({
          participantId: 'p-old',
          missionId: 'm-old',
          createdAt: '2026-09-05T10:00:00.000Z',
          rallyPointId: 'rp1',
          templateId: 'the-metronome',
          workout: [{ name: 'Fast Air Squats', target: 15 }],
          movementCount: 1,
          repsPerRound: 15,
        }),
      ],
      chains: {},
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('The Piston')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Show chained missions' })).toBeTruthy();
    });
    expect(screen.getByText(/1 of 2 in this chain/)).toBeTruthy();
    expect(screen.queryByText('The Metronome')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show chained missions' }));

    expect(screen.getByText('The Metronome')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide chained missions' })).toBeTruthy();
  });
});

describe('MyMissionsPage CTAs', () => {
  it('links Plan mission and New campaign to their routes', async () => {
    fetchMyMissionsMock.mockResolvedValue({ data: [], chains: {}, error: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Plan mission' }).getAttribute('href')).toBe(
        '/create'
      );
      expect(screen.getByRole('link', { name: 'New campaign' }).getAttribute('href')).toBe(
        '/campaign/new'
      );
    });
  });
});

describe('MyMissionsPage relaunch', () => {
  it('creates a new mission from the card workout and navigates to it', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [
        entry({
          missionId: 'old-mission',
          durationMinutes: 10,
          templateId: 'the-pendulum',
          workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
          movementCount: 1,
          state: 'finished',
          finalScore: 42,
        }),
      ],
      chains: {},
      error: null,
    });
    fetchHostActiveMissionCountMock.mockResolvedValue({ data: 0, error: null });
    fetchMyMissionDetailMock.mockResolvedValue({
      data: {
        missionId: 'old-mission',
        workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
        intensityTier: 4,
        scoreBreakdown: null,
      },
      error: null,
    });
    createRallyPointMissionMock.mockResolvedValue({
      data: {
        rallyPointId: 'rp-1',
        rallyPointMemberId: 'rpm-1',
        missionId: 'new-mission',
        hostToken: 'host',
        participantId: 'part-1',
        claimToken: 'claim',
      },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Re-launch mission' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Re-launch mission' }));

    await waitFor(() => {
      expect(createRallyPointMissionMock).toHaveBeenCalledWith({
        nickname: 'Justin',
        durationMinutes: 10,
        workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
        templateId: 'the-pendulum',
        intensityTier: 4,
      });
      expect(navigateMock).toHaveBeenCalledWith('/mission/new-mission');
    });
  });

  it('blocks relaunch when the athlete has no nickname', async () => {
    athleteProfileState.profile = null;
    fetchMyMissionsMock.mockResolvedValue({
      data: [entry({ missionId: 'old-mission', state: 'finished', finalScore: 10 })],
      chains: {},
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Re-launch mission' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Re-launch mission' }));

    await waitFor(() => {
      expect(screen.getByText(/Add your name in Your profile before launching/)).toBeTruthy();
    });
    expect(createRallyPointMissionMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('blocks relaunch when the host is at the active mission limit', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [entry({ missionId: 'old-mission', state: 'finished', finalScore: 10 })],
      chains: {},
      error: null,
    });
    fetchHostActiveMissionCountMock.mockResolvedValue({ data: 3, error: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Re-launch mission' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Re-launch mission' }));

    await waitFor(() => {
      expect(screen.getByText(/You already have 3 active missions/)).toBeTruthy();
    });
    expect(fetchMyMissionDetailMock).not.toHaveBeenCalled();
    expect(createRallyPointMissionMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('MyMissionsPage tabs', () => {
  it('defaults to Missions and switches section panels', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [entry()],
      chains: {},
      error: null,
    });
    fetchMyCampaignsMock.mockResolvedValue({
      data: [campaign()],
      error: null,
    });
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [],
      resolved: [],
      unreadCount: 0,
      error: null,
    });
    fetchInvitationUnreadCountMock.mockResolvedValue({ unreadCount: 2, error: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'My missions sections' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Missions' }).getAttribute('aria-selected')).toBe(
        'true'
      );
      expect(screen.getByRole('link', { name: 'Start this mission' })).toBeTruthy();
    });

    expect(screen.queryByText('Your campaigns')).toBeNull();
    expect(screen.queryByText(/Nothing waiting/)).toBeNull();
    expect(screen.getByRole('tab', { name: /Sent to you/ }).textContent).toContain('2');

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Campaigns' }).getAttribute('aria-selected')).toBe(
        'true'
      );
      expect(screen.getByText('Your campaigns')).toBeTruthy();
      expect(screen.getByText('Spring Build')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'View campaign' }).getAttribute('href')).toBe(
        '/campaign/33333333-3333-4333-8333-333333333333'
      );
    });

    fireEvent.click(screen.getByRole('tab', { name: /Sent to you/ }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Sent to you/ }).getAttribute('aria-selected')).toBe(
        'true'
      );
      expect(screen.getByText('Nothing waiting.')).toBeTruthy();
    });
  });

  it('lists a pending invitation in Sent to you', async () => {
    fetchMyMissionsMock.mockResolvedValue({ data: [entry()], chains: {}, error: null });
    fetchMyCampaignsMock.mockResolvedValue({ data: [], error: null });
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [
        {
          invitationId: 'inv-1',
          deliveryId: 'del-1',
          type: 'workout',
          status: 'pending',
          readAt: null,
          createdAt: '2026-09-11T12:00:00.000Z',
          note: 'Same time tomorrow?',
          fromUserId: 'user-2',
          fromNickname: 'Alex',
          includeSquadInvite: false,
          durationMinutes: 15,
          workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
          templateId: null,
          intensityTier: null,
          assignedWorkoutId: 'aw-1',
          squadRequestId: null,
          squadStatus: null,
          resultingMissionId: null,
          resultingCampaignId: null,
          sourceMissionId: 'm-1',
          sourceMessageId: null,
          mission: null,
          campaign: null,
        },
      ],
      resolved: [],
      unreadCount: 1,
      error: null,
    });
    fetchInvitationUnreadCountMock.mockResolvedValue({ unreadCount: 1, error: null });

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Sent to you/ }));

    await waitFor(() => {
      expect(screen.getByText('Alex shared a 15-minute workout')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start 15-min mission' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    });
  });
});

describe('MyMissionsPage campaigns', () => {
  it('lists campaigns with a link to the campaign detail', async () => {
    fetchMyMissionsMock.mockResolvedValue({ data: [], chains: {}, error: null });
    fetchMyCampaignsMock.mockResolvedValue({
      data: [campaign()],
      error: null,
    });
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [],
      resolved: [],
      unreadCount: 0,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));

    await waitFor(() => {
      expect(screen.getByText('Your campaigns')).toBeTruthy();
      expect(screen.getByText('Spring Build')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'View campaign' }).getAttribute('href')).toBe(
        '/campaign/33333333-3333-4333-8333-333333333333'
      );
    });
  });
});
