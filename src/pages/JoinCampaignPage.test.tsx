import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinCampaignPage from './JoinCampaignPage';

const previewMock = vi.fn();
const joinMock = vi.fn();
const navigateMock = vi.fn();
let authenticated = true;
const profileState = vi.hoisted(() => ({
  profile: null as { username: string; nickname: string } | null,
  missing: false,
  loading: false,
  error: null as string | null,
}));
const ensureThenMock = vi.hoisted(() => vi.fn((action: () => void) => action()));
const identityOverlayState = vi.hoisted(() => ({
  open: false,
}));

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
  useAthleteProfile: () => ({
    profile: profileState.profile,
    missing: profileState.missing,
    loading: profileState.loading,
    error: profileState.error,
  }),
}));
vi.mock('@/hooks/useEnsureAthleteIdentity', () => ({
  useEnsureAthleteIdentity: () => ({
    ensureThen: ensureThenMock,
    open: identityOverlayState.open,
    overlayProps: {
      acceptLabel: 'Accept & join',
      dismissible: true,
      onClose: vi.fn(),
      onAccept: vi.fn(),
    },
  }),
}));
vi.mock('@/components/onboarding/IdentityOverlay', () => ({
  IdentityOverlay: () => <div>Identity overlay</div>,
}));
vi.mock('@/components/AuthModal', () => ({
  AuthModal: () => <div>Auth modal</div>,
}));

function preview(overrides = {}) {
  return {
    name: 'Winter Engine Build',
    goal: 'Eight rounds by week four.',
    weekCount: 8,
    missionsPerWeek: 3,
    status: 'active',
    hostNickname: 'Maya',
    memberCount: 4,
    memberLimit: 50,
    firstMissionDate: '2026-10-05',
    lastMissionDate: '2026-11-27',
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
  profileState.profile = { username: 'maya', nickname: 'Maya' };
  profileState.missing = false;
  profileState.loading = false;
  profileState.error = null;
  ensureThenMock.mockClear();
  identityOverlayState.open = false;
  previewMock.mockResolvedValue({ data: preview(), error: null });
  joinMock.mockResolvedValue({
    data: { campaignId: 'c1', name: 'Winter', alreadyMember: false },
    error: null,
  });
});

describe('JoinCampaignPage', () => {
  it('shows what the invite is for before asking for anything', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Winter Engine Build')).toBeTruthy());
    expect(screen.getByText(/24 missions · 3 a week · 8 weeks/)).toBeTruthy();
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy()
    );
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

  it('opens the identity overlay path before join when identity is missing', async () => {
    profileState.profile = null;
    profileState.missing = true;
    identityOverlayState.open = true;
    ensureThenMock.mockImplementationOnce(() => {});
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Join campaign' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Join campaign' }));

    expect(ensureThenMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Identity overlay')).toBeTruthy();
  });

  it('retries through the identity overlay when the RPC says profile is required', async () => {
    joinMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Complete your profile before starting a campaign.' },
      })
      .mockResolvedValueOnce({
        data: { campaignId: 'c1', name: 'Winter', alreadyMember: false },
        error: null,
      });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Join campaign' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Join campaign' }));

    await waitFor(() => expect(joinMock).toHaveBeenCalledTimes(2));
    expect(ensureThenMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/campaign/c1'));
  });
});
