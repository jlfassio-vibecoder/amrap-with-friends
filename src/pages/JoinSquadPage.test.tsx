import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinSquadPage from './JoinSquadPage';

const previewMock = vi.fn();
const acceptMock = vi.fn();
const navigateMock = vi.fn();
let authenticated = true;
const profileState = vi.hoisted(() => ({
  profile: null as { username: string; nickname: string } | null,
  missing: false,
  loading: false,
  error: null as string | null,
}));
const ensureThenMock = vi.hoisted(() => vi.fn((action: () => void) => action()));

vi.mock('@/lib/api/squad', () => ({
  fetchSquadInvitePreview: (...args: unknown[]) => previewMock(...args),
  acceptSquadInviteCode: (...args: unknown[]) => acceptMock(...args),
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
    overlay: 'Identity overlay',
  }),
}));
vi.mock('@/components/AuthModal', () => ({
  AuthModal: () => <div>Auth modal</div>,
}));

function renderPage(search = '?c=ABC123') {
  return render(
    <MemoryRouter initialEntries={[`/squad/join${search}`]}>
      <ThemeProvider>
        <JoinSquadPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  previewMock.mockReset();
  acceptMock.mockReset();
  navigateMock.mockReset();
  authenticated = true;
  profileState.profile = { username: 'maya', nickname: 'Maya' };
  profileState.missing = false;
  profileState.loading = false;
  profileState.error = null;
  ensureThenMock.mockClear();
  previewMock.mockResolvedValue({
    data: { username: 'maya', nickname: 'Maya' },
    error: null,
  });
  acceptMock.mockResolvedValue({ error: null });
});

describe('JoinSquadPage', () => {
  it('shows who invited you before asking for anything', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Maya invited you')).toBeTruthy());
  });

  it('previews for a signed-out visitor and offers sign-in', async () => {
    authenticated = false;
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy()
    );
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
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

  it('accepts and navigates to the squad page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('ABC123'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/squad'));
  });

  it('handles a link with no code at all', async () => {
    renderPage('');
    await waitFor(() => expect(screen.getByText('That invite link is not valid.')).toBeTruthy());
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('surfaces an accept failure and stays put', async () => {
    acceptMock.mockResolvedValue({ error: { message: 'That invite is not available.' } });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByText('That invite is not available.')).toBeTruthy());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('opens the identity overlay path before accept when identity is missing', async () => {
    profileState.profile = null;
    profileState.missing = true;
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(ensureThenMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Identity overlay')).toBeTruthy();
  });

  it('retries through the identity overlay when the RPC says profile is required', async () => {
    acceptMock
      .mockResolvedValueOnce({
        error: { message: 'Complete your profile before inviting people to your squad.' },
      })
      .mockResolvedValueOnce({ error: null });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(acceptMock).toHaveBeenCalledTimes(2));
    expect(ensureThenMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/squad'));
  });
});
