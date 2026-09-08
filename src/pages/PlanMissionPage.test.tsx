import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('renders path cards and every preset', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Plan mission' }).getAttribute('href')).toBe('/create');
    expect(screen.getByRole('link', { name: 'New campaign' }).getAttribute('href')).toBe(
      '/campaign/new'
    );

    for (const preset of CHAIN_MISSION_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy();
    }
    for (const preset of CAMPAIGN_MISSION_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy();
    }
    expect(screen.getAllByText('Sprint').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Crucible').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Grind').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Marathon').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Crucible + Grind')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Launch' })).toHaveLength(16);
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(16);
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

  it('starts a campaign preset', async () => {
    renderPage();

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
