import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import MyMissionsPage from './MyMissionsPage';
import type { CampaignSummary } from '@/lib/api/campaigns';
import type { MyMissionEntry } from '@/lib/api/myMissions';

const fetchMyMissionsMock = vi.fn();
const deleteIncompleteMissionMock = vi.fn();
const fetchMyCampaignsMock = vi.fn();
const authUser = { id: 'user-1' };

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: authUser,
  }),
}));

vi.mock('@/lib/api/myMissions', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/myMissions')>('@/lib/api/myMissions');
  return {
    ...actual,
    fetchMyMissions: (...args: unknown[]) => fetchMyMissionsMock(...args),
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
    templateId: null,
    state: 'waiting',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
    scoreBreakdown: null,
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
  deleteIncompleteMissionMock.mockReset();
  fetchMyCampaignsMock.mockReset();
  vi.unstubAllGlobals();
});

function renderPage() {
  fetchMyCampaignsMock.mockResolvedValue({ data: [], error: null });
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
          state: 'finished',
          finalScore: 42,
        }),
      ],
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
        }),
      ],
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
          scoreBreakdown: {
            baseScore: 100,
            pvi: null,
            pviMultiplier: 1,
            domainWeight: 1,
            finalScore: 100,
          },
        }),
      ],
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('View mission')).toHaveLength(3);
    });

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'View breakdown' })).toBeTruthy();
  });

  it('confirms then deletes and removes the row', async () => {
    fetchMyMissionsMock.mockResolvedValue({
      data: [entry()],
      error: null,
    });
    deleteIncompleteMissionMock.mockImplementation(async () => ({ error: null }));
    const confirmMock = vi.fn(() => true);
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
      error: null,
    });
    deleteIncompleteMissionMock.mockImplementation(async () => ({ error: null }));
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Featured/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmMock).toHaveBeenCalledWith(expect.stringMatching(/this date and time only/i));
  });
});

describe('MyMissionsPage CTAs', () => {
  it('links Create mission and New campaign to their routes', async () => {
    fetchMyMissionsMock.mockResolvedValue({ data: [], error: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Create mission' }).getAttribute('href')).toBe(
        '/create'
      );
      expect(screen.getByRole('link', { name: 'New campaign' }).getAttribute('href')).toBe(
        '/campaign/new'
      );
    });
  });
});

describe('MyMissionsPage campaigns', () => {
  it('lists campaigns with a link to the campaign detail', async () => {
    fetchMyMissionsMock.mockResolvedValue({ data: [], error: null });
    fetchMyCampaignsMock.mockResolvedValue({
      data: [campaign()],
      error: null,
    });

    render(
      <MemoryRouter>
        <ThemeProvider>
          <MyMissionsPage />
        </ThemeProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Your campaigns')).toBeTruthy();
      expect(screen.getByRole('link', { name: /Spring Build/ }).getAttribute('href')).toBe(
        '/campaign/33333333-3333-4333-8333-333333333333'
      );
    });
  });
});
