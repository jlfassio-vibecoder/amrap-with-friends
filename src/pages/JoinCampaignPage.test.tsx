import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinCampaignPage from './JoinCampaignPage';

const previewMock = vi.fn();
const joinMock = vi.fn();
const navigateMock = vi.fn();
let authenticated = true;

vi.mock('@/lib/api/campaigns', () => ({
  fetchCampaignInvitePreview: (...args: unknown[]) => previewMock(...args),
  joinCampaign: (...args: unknown[]) => joinMock(...args),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authenticated,
    isAuthLoading: false,
    user: authenticated ? { id: 'u2' } : null,
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({ profile: null, missing: false, loading: false, error: null }),
}));
vi.mock('@/components/AuthModal', () => ({
  AuthModal: () => <div>Auth modal</div>,
}));

function preview(overrides = {}) {
  return {
    name: 'Winter Engine Build',
    goal: 'Eight rounds by week four.',
    weekCount: 8,
    sessionsPerWeek: 3,
    status: 'active',
    hostNickname: 'Maya',
    memberCount: 4,
    memberLimit: 50,
    firstSessionDate: '2026-10-05',
    lastSessionDate: '2026-11-27',
    ...overrides,
  };
}

function renderPage(search = '?c=ABC123') {
  return render(
    <MemoryRouter initialEntries={[`/campaign/join${search}`]}>
      <ThemeProvider>
        <JoinCampaignPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  previewMock.mockReset();
  joinMock.mockReset();
  navigateMock.mockReset();
  authenticated = true;
  previewMock.mockResolvedValue({ data: preview(), error: null });
  joinMock.mockResolvedValue({ data: { campaignId: 'c1', name: 'Winter', alreadyMember: false }, error: null });
});

describe('JoinCampaignPage', () => {
  it('shows what the invite is for before asking for anything', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Winter Engine Build')).toBeTruthy());
    expect(screen.getByText(/24 sessions · 3 a week · 8 weeks/)).toBeTruthy();
    expect(screen.getByText('Eight rounds by week four.')).toBeTruthy();
    expect(screen.getByText(/Hosted by Maya/)).toBeTruthy();
  });

  it('previews for a signed-out visitor and offers sign-in rather than a dead end', async () => {
    authenticated = false;
    renderPage();
    await waitFor(() => expect(screen.getByText('Winter Engine Build')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join campaign' })).toBeNull();
  });

  it('opens the auth modal from the sign-in prompt', async () => {
    authenticated = false;
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to join' }));
    expect(screen.getByText('Auth modal')).toBeTruthy();
  });

  it('joins and navigates to the campaign', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join campaign' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Join campaign' }));
    await waitFor(() => expect(joinMock).toHaveBeenCalledWith('ABC123'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaign/c1'));
  });

  it('sends a repeat joiner to the campaign rather than showing an error', async () => {
    joinMock.mockResolvedValue({
      data: { campaignId: 'c1', name: 'Winter', alreadyMember: true },
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join campaign' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Join campaign' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaign/c1'));
  });

  it('will not offer to join a finished campaign', async () => {
    previewMock.mockResolvedValue({ data: preview({ status: 'complete' }), error: null });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('This campaign has already finished.')).toBeTruthy()
    );
    expect(screen.queryByRole('button', { name: 'Join campaign' })).toBeNull();
  });

  it('will not offer to join a full campaign', async () => {
    previewMock.mockResolvedValue({
      data: preview({ memberCount: 50, memberLimit: 50 }),
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('This campaign is full.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Join campaign' })).toBeNull();
  });

  it('handles a link with no code at all', async () => {
    renderPage('');
    await waitFor(() => expect(screen.getByText('That invite link is not valid.')).toBeTruthy());
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('surfaces a join failure and stays put', async () => {
    joinMock.mockResolvedValue({ data: null, error: { message: 'This campaign is full.' } });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join campaign' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Join campaign' }));
    await waitFor(() => expect(screen.getByText('This campaign is full.')).toBeTruthy());
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
