import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthForm } from './AuthForm';

const authApi = vi.hoisted(() => ({
  signInWithMagicLink: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpWithPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  isAuthenticated: false,
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    signInWithMagicLink: authApi.signInWithMagicLink,
    signInWithGoogle: authApi.signInWithGoogle,
    signUpWithPassword: authApi.signUpWithPassword,
    signInWithPassword: authApi.signInWithPassword,
    requestPasswordReset: authApi.requestPasswordReset,
    isAuthenticated: authApi.isAuthenticated,
  }),
}));

const isMagicLinkAuthEnabledMock = vi.hoisted(() => vi.fn(() => true));
const isPasswordResetEnabledMock = vi.hoisted(() => vi.fn(() => false));
const isGoogleAuthEnabledMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => isMagicLinkAuthEnabledMock(),
  isPasswordResetEnabled: () => isPasswordResetEnabledMock(),
  isGoogleAuthEnabled: () => isGoogleAuthEnabledMock(),
}));

afterEach(() => {
  cleanup();
  authApi.isAuthenticated = false;
  authApi.signInWithMagicLink.mockReset();
  authApi.signInWithGoogle.mockReset();
  authApi.signUpWithPassword.mockReset();
  authApi.signInWithPassword.mockReset();
  authApi.requestPasswordReset.mockReset();
  isMagicLinkAuthEnabledMock.mockReset();
  isMagicLinkAuthEnabledMock.mockReturnValue(true);
  isPasswordResetEnabledMock.mockReset();
  isPasswordResetEnabledMock.mockReturnValue(false);
  isGoogleAuthEnabledMock.mockReset();
  isGoogleAuthEnabledMock.mockReturnValue(false);
});

describe('AuthForm', () => {
  it('opens on password sign-in when magic link is enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(true);

    render(<AuthForm showHeading />);

    expect(screen.getByRole('tab', { name: 'Magic link' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Password' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Password' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.queryByRole('button', { name: 'Send magic link' })).toBeNull();
    expect(
      screen
        .getAllByRole('button', { name: 'Sign in' })
        .some((button) => button.getAttribute('type') === 'submit')
    ).toBe(true);
  });

  it('shows magic-link submit after switching tabs when enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(true);

    render(<AuthForm showHeading />);

    fireEvent.click(screen.getByRole('tab', { name: 'Magic link' }));
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeTruthy();
  });

  it('shows password-only sign-in when magic link is disabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthForm showHeading />);

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

    render(<AuthForm showHeading initialPasswordMode="sign-up" />);

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeTruthy();
    const createButtons = screen.getAllByRole('button', { name: 'Create account' });
    expect(createButtons.some((button) => button.getAttribute('type') === 'submit')).toBe(true);
  });

  it('compact variant uses a segmented pill toggle for sign-in mode', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthForm variant="compact" showAuthMethodSelector={false} />);

    expect(screen.getByRole('tablist', { name: 'Account action' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sign in' }).getAttribute('aria-selected')).toBe('true');
  });

  it('compact variant uses placeholders and hides the password length hint', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthForm variant="compact" showAuthMethodSelector={false} />);

    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password (6+ characters)')).toBeTruthy();
    expect(screen.queryByText('At least 6 characters.')).toBeNull();
  });

  it('keeps the password revealable after create account and waits for Continue', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    authApi.signUpWithPassword.mockResolvedValue({
      error: null,
      needsEmailConfirmation: false,
    });
    const onAuthenticated = vi.fn();

    render(
      <AuthForm showHeading initialPasswordMode="sign-up" onAuthenticated={onAuthenticated} />
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();
    fireEvent.change(passwordInput!, { target: { value: 'secret1' } });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Create account' })
        .find((button) => button.getAttribute('type') === 'submit')!
    );

    expect(await screen.findByText("You're signed in.")).toBeTruthy();
    expect(passwordInput?.hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Show password' }).hasAttribute('disabled')).toBe(
      false
    );
    expect(onAuthenticated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('closes immediately after password sign-in', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    authApi.signInWithPassword.mockResolvedValue({ error: null });
    const onAuthenticated = vi.fn();

    render(<AuthForm showHeading onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput!, { target: { value: 'secret1' } });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Sign in' })
        .find((button) => button.getAttribute('type') === 'submit')!
    );

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('switches to sign-in after a duplicate create-account error', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    authApi.signUpWithPassword.mockResolvedValue({
      error: 'An account with this email already exists. Sign in.',
      needsEmailConfirmation: false,
    });

    render(<AuthForm showHeading initialPasswordMode="sign-up" />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput!, { target: { value: 'secret1' } });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Create account' })
        .find((button) => button.getAttribute('type') === 'submit')!
    );

    expect(
      await screen.findByText('An account with this email already exists. Sign in.')
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(
      screen
        .getAllByRole('button', { name: 'Sign in' })
        .some((button) => button.getAttribute('type') === 'submit')
    ).toBe(true);
  });

  it('hides Forgot password when reset is disabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isPasswordResetEnabledMock.mockReturnValue(false);

    render(<AuthForm showHeading />);

    expect(screen.queryByRole('button', { name: 'Forgot password?' })).toBeNull();
  });

  it('shows Forgot password and sends a reset when enabled', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isPasswordResetEnabledMock.mockReturnValue(true);
    authApi.requestPasswordReset.mockResolvedValue({ error: null });

    render(<AuthForm showHeading />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    await waitFor(() => {
      expect(authApi.requestPasswordReset).toHaveBeenCalledWith('athlete@example.com');
    });
    expect(await screen.findByText('Check your email for a reset link.')).toBeTruthy();
  });

  it('hides Continue with Google when Google auth is disabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isGoogleAuthEnabledMock.mockReturnValue(false);

    render(<AuthForm showHeading />);

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
  });

  it('shows Continue with Google and invokes the provider when enabled', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isGoogleAuthEnabledMock.mockReturnValue(true);
    authApi.signInWithGoogle.mockResolvedValue({ error: null });

    render(<AuthForm showHeading />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(authApi.signInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces Google sign-in errors', async () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isGoogleAuthEnabledMock.mockReturnValue(true);
    authApi.signInWithGoogle.mockResolvedValue({ error: 'Google sign-in failed.' });

    render(<AuthForm showHeading />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByText('Google sign-in failed.')).toBeTruthy();
  });

  it('shows and clears OAuth return errors from the URL when Google is enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);
    isGoogleAuthEnabledMock.mockReturnValue(true);

    const replaceState = vi.fn();
    const originalLocation = window.location;
    const originalReplaceState = window.history.replaceState;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/create',
        search: '?error=access_denied&error_description=User+cancelled+login&c=keep',
        hash: '',
      },
    });
    window.history.replaceState = replaceState;

    try {
      render(<AuthForm showHeading />);

      expect(screen.getByText('Google sign-in was cancelled.')).toBeTruthy();
      expect(replaceState).toHaveBeenCalledWith(window.history.state, '', '/create?c=keep');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
      window.history.replaceState = originalReplaceState;
    }
  });
});
