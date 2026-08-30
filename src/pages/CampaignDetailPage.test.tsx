import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import CampaignDetailPage from './CampaignDetailPage';

const fetchDetailMock = vi.fn();
const leaveMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/lib/api/campaigns', () => ({
  fetchCampaignDetail: (...args: unknown[]) => fetchDetailMock(...args),
  leaveCampaign: (...args: unknown[]) => leaveMock(...args),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({ profile: null, missing: false, loading: false, error: null }),
}));

function occurrence(sequence: number, weekNumber: number, overrides = {}) {
  return {
    occurrenceId: `o${sequence}`,
    sequence,
    weekNumber,
    slotNumber: 1,
    localDate: '2026-10-05',
    localTime: '06:30',
    templateId: 'the-valve',
    durationMinutes: 10,
    intensityTier: 3,
    workout: [{ name: 'Air Squats', target: 10 }],
    sessionId: null,
    status: 'planned',
    ...overrides,
  };
}

function detail(overrides = {}) {
  return {
    campaignId: 'c1',
    name: 'Winter Engine Build',
    goal: 'Eight rounds by week four.',
    weekCount: 2,
    sessionsPerWeek: 2,
    startDate: '2026-10-05',
    timezone: 'America/Denver',
    status: 'active',
    viewerRole: 'host',
    inviteCode: 'ABC123',
    occurrences: [
      occurrence(1, 1, { status: 'done' }),
      occurrence(2, 1),
      occurrence(3, 2),
      occurrence(4, 2),
    ],
    members: [
      { userId: 'u1', role: 'host', nickname: 'Maya', joinedAt: '2026-09-01T00:00:00Z' },
      { userId: 'u2', role: 'member', nickname: 'Jules', joinedAt: '2026-09-02T00:00:00Z' },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/campaign/c1']}>
      <ThemeProvider>
        <Routes>
          <Route path="/campaign/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  fetchDetailMock.mockReset();
  leaveMock.mockReset();
  navigateMock.mockReset();
  fetchDetailMock.mockResolvedValue({ data: detail(), error: null });
  leaveMock.mockResolvedValue({ error: null });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('CampaignDetailPage', () => {
  it('loads the campaign for the id in the route', async () => {
    renderPage();
    await waitFor(() => expect(fetchDetailMock).toHaveBeenCalledWith('c1'));
    expect(screen.getAllByText('Winter Engine Build').length).toBeGreaterThan(0);
    expect(screen.getByText('Eight rounds by week four.')).toBeTruthy();
  });

  it('reports progress from the occurrences that are done', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1 of 4 sessions done')).toBeTruthy());
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('groups the schedule into weeks', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Week 1')).toBeTruthy());
    expect(screen.getByText('Week 2')).toBeTruthy();
  });

  it('lists the crew and marks the host', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Maya/)).toBeTruthy());
    expect(screen.getByText(/Jules/)).toBeTruthy();
    expect(screen.getByText('Host')).toBeTruthy();
  });

  it('links a generated session to its staging area and leaves planned ones inert', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({
        occurrences: [
          occurrence(1, 1, { status: 'generated', sessionId: 's1' }),
          occurrence(2, 1),
        ],
      }),
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Staging area open' })).toBeTruthy());
    expect(
      screen.getByRole('link', { name: 'Staging area open' }).getAttribute('href')
    ).toBe('/session/s1');
    expect(screen.queryByRole('link', { name: 'Planned' })).toBeNull();
  });

  it('shows the error copy when the campaign is not available', async () => {
    fetchDetailMock.mockResolvedValue({
      data: null,
      error: { message: 'That campaign is not available.' },
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('That campaign is not available.')).toBeTruthy()
    );
  });

  it('gives the host a rally link to share, without printing the raw code', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'COPY RALLY LINK' })).toBeTruthy()
    );
    expect(screen.queryByText('ABC123')).toBeNull();
  });

  it('copies the invite URL built from the code', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'COPY RALLY LINK' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'COPY RALLY LINK' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/campaign/join?c=ABC123')
      )
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'LINK COPIED' })).toBeTruthy());
  });

  it('offers no invite or leave control to the host beyond sharing', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Week 1')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Leave campaign' })).toBeNull();
  });

  it('lets a member leave, but confirms first', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({ viewerRole: 'member', inviteCode: null }),
      error: null,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Leave campaign' })).toBeTruthy()
    );
    // Sharing is host-only.
    expect(screen.queryByRole('button', { name: 'COPY RALLY LINK' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Leave campaign' }));
    expect(leaveMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
    await waitFor(() => expect(leaveMock).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('lets a member back out of leaving', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({ viewerRole: 'member', inviteCode: null }),
      error: null,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Leave campaign' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Leave campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('button', { name: 'Leave campaign' })).toBeTruthy();
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it('surfaces a failed leave instead of navigating away', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({ viewerRole: 'member', inviteCode: null }),
      error: null,
    });
    leaveMock.mockResolvedValue({ error: { message: 'That campaign is not available.' } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Leave campaign' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Leave campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
    await waitFor(() =>
      expect(screen.getByText('That campaign is not available.')).toBeTruthy()
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
