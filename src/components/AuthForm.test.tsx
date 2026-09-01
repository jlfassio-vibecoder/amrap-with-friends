import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthForm } from './AuthForm';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    signInWithMagicLink: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    isAuthenticated: authState.isAuthenticated,
  }),
}));

const isMagicLinkAuthEnabledMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => isMagicLinkAuthEnabledMock(),
}));

afterEach(() => {
  cleanup();
  authState.isAuthenticated = false;
  isMagicLinkAuthEnabledMock.mockReset();
  isMagicLinkAuthEnabledMock.mockReturnValue(true);
});

describe('AuthForm', () => {
  it('shows magic link and password tabs when magic link is enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(true);

    render(<AuthForm showHeading />);

    expect(screen.getByRole('tab', { name: 'Magic link' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Password' })).toBeTruthy();
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
});
