import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthModal } from './AuthModal';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    signInWithMagicLink: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    isAuthenticated: authState.isAuthenticated,
  }),
}));

const isMagicLinkAuthEnabledMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => isMagicLinkAuthEnabledMock(),
  isPasswordResetEnabled: () => false,
  isGoogleAuthEnabled: () => false,
}));

afterEach(() => {
  cleanup();
  authState.isAuthenticated = false;
  isMagicLinkAuthEnabledMock.mockReset();
  isMagicLinkAuthEnabledMock.mockReturnValue(true);
});

describe('AuthModal', () => {
  it('shows a secondary email-link control when magic link is enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(true);

    render(<AuthModal onClose={() => {}} />);

    expect(screen.queryByRole('tab', { name: 'Magic link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use an email link instead' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send magic link' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use an email link instead' }));
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeTruthy();
  });

  it('shows password-only sign-in when magic link is disabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthModal onClose={() => {}} />);

    expect(screen.queryByRole('tab', { name: 'Magic link' })).toBeNull();
    expect(screen.queryByText('Email and password')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    const signInButtons = screen.getAllByRole('button', { name: 'Sign in' });
    expect(signInButtons).toHaveLength(2);
    expect(signInButtons.some((button) => button.getAttribute('type') === 'submit')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Send magic link' })).toBeNull();
  });

  it('opens on create-account password mode when requested', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthModal onClose={() => {}} initialPasswordMode="sign-up" />);

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy();
    const createButtons = screen.getAllByRole('button', { name: 'Create account' });
    expect(createButtons.some((button) => button.getAttribute('type') === 'submit')).toBe(true);
  });

  it('shows Launch heading and hides guest copy when required', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(
      <AuthModal
        onClose={() => {}}
        guestAllowed={false}
        heading="Save & Launch"
        subtitle="Create an account to hit the rally point and join the leaderboard."
      />
    );

    expect(screen.getByRole('heading', { name: 'Save & Launch' })).toBeTruthy();
    expect(
      screen.getByText('Create an account to hit the rally point and join the leaderboard.')
    ).toBeTruthy();
    expect(screen.queryByText(/Optional — play as a guest/)).toBeNull();
  });
});
