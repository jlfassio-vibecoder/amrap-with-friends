import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthModal } from './AuthModal';

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

describe('AuthModal', () => {
  it('shows magic link and password tabs when magic link is enabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(true);

    render(<AuthModal onClose={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Magic link' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeTruthy();
  });

  it('shows password-only sign-in when magic link is disabled', () => {
    isMagicLinkAuthEnabledMock.mockReturnValue(false);

    render(<AuthModal onClose={() => {}} />);

    expect(screen.queryByRole('tab', { name: 'Magic link' })).toBeNull();
    expect(screen.getByText('Email and password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    const signInButtons = screen.getAllByRole('button', { name: 'Sign in' });
    expect(signInButtons).toHaveLength(2);
    expect(signInButtons.some((button) => button.getAttribute('type') === 'submit')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Send magic link' })).toBeNull();
  });
});
