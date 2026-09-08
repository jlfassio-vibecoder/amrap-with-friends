import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { CAMPAIGN_MISSION_PRESETS, CHAIN_MISSION_PRESETS } from '@/data/planMissionPresets';
import PlanMissionPage from './PlanMissionPage';

const createRallyPointMissionMock = vi.fn();
const persistMissionChainMock = vi.fn();
const createCampaignMock = vi.fn();
const fetchHostActiveMissionCountMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/lib/api/rallyPoint', () => ({
  createRallyPointMission: (...args: unknown[]) => createRallyPointMissionMock(...args),
}));
vi.mock('@/lib/api/missionChain', () => ({
  setMissionChain: (...args: unknown[]) => persistMissionChainMock(...args),
}));
vi.mock('@/lib/api/campaigns', () => ({
  createCampaign: (...args: unknown[]) => createCampaignMock(...args),
}));
vi.mock('@/lib/api/missions', () => ({
  fetchHostActiveMissionCount: (...args: unknown[]) => fetchHostActiveMissionCountMock(...args),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1', email: 'host@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: { nickname: 'Maya', username: 'maya' },
    missing: false,
    loading: false,
    error: null,
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/plan-mission']}>
      <ThemeProvider>
        <PlanMissionPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  createRallyPointMissionMock.mockResolvedValue({
    data: {
      rallyPointId: 'rp-1',
      missionId: 'm-1',
      participantId: 'p-1',
      hostToken: 'ht',
      claimToken: 'ct',
      rallyPointMemberId: 'rpm-1',
    },
    error: null,
  });
  persistMissionChainMock.mockResolvedValue({ data: [], error: null });
  createCampaignMock.mockResolvedValue({
    data: { campaignId: 'camp-1' },
    error: null,
  });
  fetchHostActiveMissionCountMock.mockResolvedValue({ data: 0, error: null });
  navigateMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('PlanMissionPage', () => {
  it('defaults to mission chains and toggles to campaigns', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Plan mission' }).getAttribute('href')).toBe('/create');
    expect(screen.getByRole('link', { name: 'New campaign' }).getAttribute('href')).toBe(
      '/campaign/new'
    );

    expect(screen.getByRole('tab', { name: 'Mission chains' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getByRole('heading', { name: 'Ready-made mission chains' })).toBeTruthy();
    for (const preset of CHAIN_MISSION_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: 'Launch' })).toHaveLength(16);
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));

    expect(screen.getByRole('heading', { name: 'Ready-made campaigns' })).toBeTruthy();
    for (const preset of CAMPAIGN_MISSION_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(16);
    expect(screen.queryByRole('button', { name: 'Launch' })).toBeNull();
  });

  it('filters chains by goal and focus without changing the campaigns tab filter', () => {
    renderPage();

    const allLaunchCount = screen.getAllByRole('button', { name: 'Launch' }).length;
    expect(allLaunchCount).toBe(16);

    const goalTabs = screen.getByRole('tablist', { name: 'Fitness goal' });
    fireEvent.click(within(goalTabs).getByRole('tab', { name: 'Weight Loss & Fat Burning' }));

    const weightLossLaunchCount = screen.getAllByRole('button', { name: 'Launch' }).length;
    expect(weightLossLaunchCount).toBeGreaterThan(0);
    expect(weightLossLaunchCount).toBeLessThan(16);

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(16);

    fireEvent.click(screen.getByRole('tab', { name: 'Mission chains' }));
    expect(screen.getAllByRole('button', { name: 'Launch' })).toHaveLength(weightLossLaunchCount);

    fireEvent.click(
      within(screen.getByRole('tablist', { name: 'Fitness goal' })).getByRole('tab', {
        name: 'Muscle Building & Toning',
      })
    );
    const focusTabs = screen.getByRole('tablist', { name: 'Fitness focus' });
    expect(within(focusTabs).getByRole('tab', { name: 'Abs & Spot Targets' })).toBeTruthy();
    fireEvent.click(within(focusTabs).getByRole('tab', { name: 'Abs & Spot Targets' }));

    expect(screen.getByText('Iron lock')).toBeTruthy();
    expect(screen.queryByText('Sprint triple')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Launch' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty copy for mobility focus', () => {
    renderPage();

    fireEvent.click(
      within(screen.getByRole('tablist', { name: 'Fitness goal' })).getByRole('tab', {
        name: 'Flexibility & Posture',
      })
    );
    fireEvent.click(
      within(screen.getByRole('tablist', { name: 'Fitness focus' })).getByRole('tab', {
        name: 'Mobility & Posture',
      })
    );

    expect(screen.getByText('No ready-made packs for this goal yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Launch' })).toBeNull();
  });

  it('launches a chain preset into the first mission', async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Launch' })[0]!);

    await waitFor(() => {
      expect(createRallyPointMissionMock).toHaveBeenCalled();
      expect(persistMissionChainMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/mission/m-1');
    });
  });

  it('shows why Launch is disabled when the active-mission cap is reached', async () => {
    fetchHostActiveMissionCountMock.mockResolvedValue({ data: 3, error: null });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('You already have 3 active missions.')).toBeTruthy();
    });
    expect((screen.getAllByRole('button', { name: 'Launch' })[0] as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('starts a campaign preset', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0]!);

    await waitFor(() => {
      expect(createCampaignMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/campaign/camp-1');
    });

    const input = createCampaignMock.mock.calls[0]?.[0] as {
      name: string;
      weekCount: number;
      occurrences: unknown[];
    };
    expect(input.name).toBe(CAMPAIGN_MISSION_PRESETS[0]!.name);
    expect(input.weekCount).toBe(4);
    expect(input.occurrences.length).toBeGreaterThan(0);
  });
});
