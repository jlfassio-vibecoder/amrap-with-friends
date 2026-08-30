import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import CampaignDetailPage from './CampaignDetailPage';

const fetchDetailMock = vi.fn();
const fetchStandingsMock = vi.fn();
const leaveMock = vi.fn();
const endMock = vi.fn();
const deleteMock = vi.fn();
const updateMock = vi.fn();
const rescheduleMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/lib/api/campaigns', () => ({
  fetchCampaignDetail: (...args: unknown[]) => fetchDetailMock(...args),
  fetchCampaignStandings: (...args: unknown[]) => fetchStandingsMock(...args),
  leaveCampaign: (...args: unknown[]) => leaveMock(...args),
  endCampaign: (...args: unknown[]) => endMock(...args),
  deleteCampaign: (...args: unknown[]) => deleteMock(...args),
  updateCampaign: (...args: unknown[]) => updateMock(...args),
  rescheduleCampaignOccurrence: (...args: unknown[]) => rescheduleMock(...args),
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
  fetchStandingsMock.mockReset();
  leaveMock.mockReset();
  endMock.mockReset();
  deleteMock.mockReset();
  updateMock.mockReset();
  rescheduleMock.mockReset();
  navigateMock.mockReset();
  fetchDetailMock.mockResolvedValue({ data: detail(), error: null });
  fetchStandingsMock.mockResolvedValue({
    data: { standings: [], members: [], scores: [] },
    error: null,
  });
  leaveMock.mockResolvedValue({ error: null });
  endMock.mockResolvedValue({ error: null });
  deleteMock.mockResolvedValue({ error: null });
  updateMock.mockResolvedValue({ error: null });
  rescheduleMock.mockResolvedValue({ error: null });
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

  it('shows empty standings copy before any session is generated', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({
        occurrences: [occurrence(1, 1), occurrence(2, 1), occurrence(3, 2), occurrence(4, 2)],
      }),
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Standings')).toBeTruthy());
    expect(
      screen.getByText('Standings show up once the first campaign session is generated.')
    ).toBeTruthy();
  });

  it('lists standings with rank, average, and sessions attended', async () => {
    fetchDetailMock.mockResolvedValue({
      data: detail({
        occurrences: [
          occurrence(1, 1, { status: 'done', sessionId: 's1' }),
          occurrence(2, 1, { status: 'generated', sessionId: 's2' }),
        ],
      }),
      error: null,
    });
    fetchStandingsMock.mockResolvedValue({
      data: {
        standings: [
          {
            userId: 'u1',
            nickname: 'Maya',
            normalisedAverage: 1,
            attended: 2,
            eligible: 2,
            left: false,
            rank: 1,
          },
          {
            userId: 'u2',
            nickname: 'Jules',
            normalisedAverage: 0.5,
            attended: 1,
            eligible: 2,
            left: true,
            rank: 2,
          },
        ],
        members: [
          {
            userId: 'u1',
            nickname: 'Maya',
            joinedLocalDate: '2026-09-01',
            left: false,
          },
          {
            userId: 'u2',
            nickname: 'Jules',
            joinedLocalDate: '2026-09-02',
            left: true,
          },
        ],
        scores: [],
      },
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('100%')).toBeTruthy());
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getAllByText('Left').length).toBeGreaterThan(0);
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
        occurrences: [occurrence(1, 1, { status: 'generated', sessionId: 's1' }), occurrence(2, 1)],
      }),
      error: null,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Staging area open' })).toBeTruthy()
    );
    expect(screen.getByRole('link', { name: 'Staging area open' }).getAttribute('href')).toBe(
      '/session/s1'
    );
    expect(screen.queryByRole('link', { name: 'Planned' })).toBeNull();
  });

  it('shows the error copy when the campaign is not available', async () => {
    fetchDetailMock.mockResolvedValue({
      data: null,
      error: { message: 'That campaign is not available.' },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('That campaign is not available.')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('That campaign is not available.')).toBeTruthy());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  describe('host controls', () => {
    /** Nothing run, host alone — the state after creating one to look at it. */
    function untouched(overrides = {}) {
      return detail({
        occurrences: [occurrence(1, 1), occurrence(2, 1), occurrence(3, 2), occurrence(4, 2)],
        members: [
          { userId: 'u1', role: 'host', nickname: 'Maya', joinedAt: '2026-09-01T00:00:00Z' },
        ],
        ...overrides,
      });
    }

    it('offers the host both ways out of a campaign that never ran', async () => {
      fetchDetailMock.mockResolvedValue({ data: untouched(), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());
      expect(screen.getByText('Delete campaign')).toBeTruthy();
    });

    it('drops the delete option once a session has been generated', async () => {
      fetchDetailMock.mockResolvedValue({
        data: untouched({
          occurrences: [
            occurrence(1, 1, { status: 'generated', sessionId: 's1' }),
            occurrence(2, 1),
            occurrence(3, 2),
            occurrence(4, 2),
          ],
        }),
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());
      expect(screen.queryByText('Delete campaign')).toBeNull();
    });

    it('drops the delete option once someone else has joined', async () => {
      fetchDetailMock.mockResolvedValue({ data: detail(), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());
      expect(screen.queryByText('Delete campaign')).toBeNull();
    });

    it('offers neither to a member', async () => {
      fetchDetailMock.mockResolvedValue({
        data: untouched({ viewerRole: 'member', inviteCode: null }),
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Leave campaign')).toBeTruthy());
      expect(screen.queryByText('End campaign')).toBeNull();
      expect(screen.queryByText('Delete campaign')).toBeNull();
    });

    it('offers neither once the campaign is over', async () => {
      fetchDetailMock.mockResolvedValue({
        data: untouched({ status: 'abandoned' }),
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Ended early')).toBeTruthy());
      expect(screen.queryByText('End campaign')).toBeNull();
      expect(screen.queryByText('Delete campaign')).toBeNull();
    });

    it('confirms before ending, and reloads so the new state is visible', async () => {
      fetchDetailMock.mockResolvedValue({ data: untouched(), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());

      fireEvent.click(screen.getByText('End campaign'));
      expect(endMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Yes, end it'));
      await waitFor(() => expect(endMock).toHaveBeenCalledWith('c1'));
      // Two loads: the first render, then the refresh after ending.
      await waitFor(() => expect(fetchDetailMock).toHaveBeenCalledTimes(2));
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('backs out of the confirmation without calling anything', async () => {
      fetchDetailMock.mockResolvedValue({ data: untouched(), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());

      fireEvent.click(screen.getByText('End campaign'));
      fireEvent.click(screen.getByText('Keep it'));
      await waitFor(() => expect(screen.getByText('End campaign')).toBeTruthy());
      expect(endMock).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('sends the host home after a delete', async () => {
      fetchDetailMock.mockResolvedValue({ data: untouched(), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('Delete campaign')).toBeTruthy());

      fireEvent.click(screen.getByText('Delete campaign'));
      fireEvent.click(screen.getByText('Yes, delete it'));
      await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('c1'));
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    });

    it('keeps the campaign readable when the server refuses', async () => {
      fetchDetailMock.mockResolvedValue({ data: untouched(), error: null });
      deleteMock.mockResolvedValue({
        error: {
          message: 'This campaign has already started, so it cannot be deleted. End it instead.',
        },
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Delete campaign')).toBeTruthy());

      fireEvent.click(screen.getByText('Delete campaign'));
      fireEvent.click(screen.getByText('Yes, delete it'));
      await waitFor(() =>
        expect(
          screen.getByText(
            'This campaign has already started, so it cannot be deleted. End it instead.'
          )
        ).toBeTruthy()
      );
      // The page is still the campaign, not an error screen.
      expect(screen.getAllByText('Winter Engine Build').length).toBeGreaterThan(0);
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe('the test section on a campaign that is over', () => {
    it('is hidden once the campaign ended without a benchmark score', async () => {
      fetchDetailMock.mockResolvedValue({ data: detail({ status: 'abandoned' }), error: null });
      fetchStandingsMock.mockResolvedValue({
        data: {
          standings: [],
          members: [{ userId: 'u1', nickname: 'Maya', joinedLocalDate: '2026-09-01', left: false }],
          scores: [],
        },
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Ended early')).toBeTruthy());
      expect(screen.queryByText('The test')).toBeNull();
      expect(screen.queryByText('Scores show up after the opening benchmark.')).toBeNull();
    });

    it('still shows the result when the finished campaign was scored', async () => {
      fetchDetailMock.mockResolvedValue({
        data: detail({
          status: 'complete',
          occurrences: [
            occurrence(1, 1, { status: 'done', templateId: 'the-valve' }),
            occurrence(2, 1, { templateId: 'other' }),
            occurrence(3, 2, { templateId: 'other-2' }),
            occurrence(4, 2, { status: 'done', templateId: 'the-valve' }),
          ],
        }),
        error: null,
      });
      fetchStandingsMock.mockResolvedValue({
        data: {
          standings: [],
          members: [{ userId: 'u1', nickname: 'Maya', joinedLocalDate: '2026-09-01', left: false }],
          scores: [
            { occurrenceId: 'o1', userId: 'u1', finalScore: 40 },
            { occurrenceId: 'o4', userId: 'u1', finalScore: 48 },
          ],
        },
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('The test')).toBeTruthy());
      expect(screen.getByText('+8 reps')).toBeTruthy();
    });
  });

  describe('editing', () => {
    it('lets the host rename the campaign and rewrite the goal', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit name and goal')).toBeTruthy());

      fireEvent.click(screen.getByText('Edit name and goal'));
      const name = screen.getByDisplayValue('Winter Engine Build');
      fireEvent.change(name, { target: { value: 'Spring Engine Build' } });
      fireEvent.change(screen.getByDisplayValue('Eight rounds by week four.'), {
        target: { value: 'Ten rounds by week eight.' },
      });
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith('c1', {
          name: 'Spring Engine Build',
          goal: 'Ten rounds by week eight.',
        })
      );
      // Reloaded, so the page shows what the server actually stored.
      await waitFor(() => expect(fetchDetailMock).toHaveBeenCalledTimes(2));
    });

    it('keeps the form open and shows why when the server refuses', async () => {
      updateMock.mockResolvedValue({
        error: { message: 'Name the campaign in 80 characters or fewer.' },
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Edit name and goal')).toBeTruthy());
      fireEvent.click(screen.getByText('Edit name and goal'));
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() =>
        expect(screen.getByText('Name the campaign in 80 characters or fewer.')).toBeTruthy()
      );
      expect(screen.getByText('Save changes')).toBeTruthy();
    });

    it('offers no edit to a member or on a closed campaign', async () => {
      fetchDetailMock.mockResolvedValue({
        data: detail({ viewerRole: 'member', inviteCode: null }),
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('Leave campaign')).toBeTruthy());
      expect(screen.queryByText('Edit name and goal')).toBeNull();

      cleanup();
      fetchDetailMock.mockResolvedValue({ data: detail({ status: 'complete' }), error: null });
      renderPage();
      await waitFor(() => expect(screen.getByText('Complete')).toBeTruthy());
      expect(screen.queryByText('Edit name and goal')).toBeNull();
    });

    it('moves a session that has not run yet', async () => {
      renderPage();
      // Session 1 is done, so only the three still planned can be moved.
      await waitFor(() => expect(screen.getAllByText('Change time').length).toBe(3));

      fireEvent.click(screen.getAllByText('Change time')[0]);
      fireEvent.change(screen.getByDisplayValue('2026-10-05'), {
        target: { value: '2026-10-06' },
      });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => expect(rescheduleMock).toHaveBeenCalledWith('o2', '2026-10-06', '06:30'));
      await waitFor(() => expect(fetchDetailMock).toHaveBeenCalledTimes(2));
    });

    it('does not offer to move a session whose staging area is open', async () => {
      fetchDetailMock.mockResolvedValue({
        data: detail({
          occurrences: [
            occurrence(1, 1, { status: 'generated', sessionId: 's1' }),
            occurrence(2, 1, { status: 'done', sessionId: 's2' }),
            occurrence(3, 2, { status: 'skipped' }),
            occurrence(4, 2),
          ],
        }),
        error: null,
      });
      renderPage();
      await waitFor(() => expect(screen.getByText('The schedule')).toBeTruthy());
      expect(screen.getAllByText('Change time').length).toBe(1);
    });

    it('keeps the row open and shows why when a move is refused', async () => {
      rescheduleMock.mockResolvedValue({
        error: { message: 'Move it before the session after it.' },
      });
      renderPage();
      await waitFor(() => expect(screen.getAllByText('Change time').length).toBe(3));
      fireEvent.click(screen.getAllByText('Change time')[0]);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() =>
        expect(screen.getByText('Move it before the session after it.')).toBeTruthy()
      );
      expect(screen.getByText('Save')).toBeTruthy();
      expect(fetchDetailMock).toHaveBeenCalledTimes(1);
    });
  });
});
