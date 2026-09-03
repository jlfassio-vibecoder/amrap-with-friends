import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { RequireIntake } from './RequireIntake';

const profileState = vi.hoisted(() => ({
  profile: null as { username: string; nickname: string } | null,
  missing: false,
  loading: false,
  error: null as string | null,
  isAuthenticated: false,
  isAuthLoading: false,
  saveIdentity: vi.fn(),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: profileState.profile,
    missing: profileState.missing,
    loading: profileState.loading,
    error: profileState.error,
    isAuthenticated: profileState.isAuthenticated,
    isAuthLoading: profileState.isAuthLoading,
    saveIdentity: profileState.saveIdentity,
  }),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    signInWithMagicLink: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    isAuthenticated: false,
  }),
}));

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => false,
  isPasswordResetEnabled: () => false,
  isGoogleAuthEnabled: () => false,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  profileState.profile = null;
  profileState.missing = false;
  profileState.loading = false;
  profileState.error = null;
  profileState.isAuthenticated = false;
  profileState.isAuthLoading = false;
  profileState.saveIdentity.mockReset();
  profileState.saveIdentity.mockResolvedValue({ error: null });
});

describe('RequireIntake', () => {
  it('offers Sign in and Create account after the modal is closed', () => {
    render(
      <MemoryRouter initialEntries={['/create']}>
        <ThemeProvider>
          <RequireIntake guestMode="sign-in" gateAllowsGuest={false}>
            <div>gated</div>
          </RequireIntake>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    const reopenSignIn = screen
      .getAllByRole('button', { name: 'Sign in' })
      .find((button) => button.className.includes('btn-primary'));
    const reopenCreate = screen
      .getAllByRole('button', { name: 'Create account' })
      .find((button) => button.className.includes('btn-neutral'));
    expect(reopenSignIn).toBeTruthy();
    expect(reopenCreate).toBeTruthy();

    fireEvent.click(reopenCreate!);
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy();
  });

  it('shows the identity overlay instead of redirecting when signed in but missing identity', () => {
    profileState.isAuthenticated = true;
    profileState.profile = null;
    profileState.missing = true;

    render(
      <MemoryRouter initialEntries={['/campaign/new']}>
        <ThemeProvider>
          <RequireIntake guestMode="sign-in" gateAllowsGuest={false}>
            <div>gated</div>
          </RequireIntake>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('gated')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByText('Sign in required')).toBeNull();
  });
});
