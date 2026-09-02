import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { RequireIntake } from './RequireIntake';

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: null,
    missing: false,
    loading: false,
    error: null,
    isAuthenticated: false,
    isAuthLoading: false,
  }),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    signInWithMagicLink: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    isAuthenticated: false,
  }),
}));

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => false,
  isPasswordResetEnabled: () => false,
}));

afterEach(() => {
  cleanup();
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
});
