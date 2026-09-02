import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDuplicateAccountError, mapAuthError } from './mapAuthError';

vi.mock('@/lib/auth/authFeatures', () => ({
  isPasswordResetEnabled: vi.fn(() => false),
  isGoogleAuthEnabled: vi.fn(() => false),
}));

import { isGoogleAuthEnabled, isPasswordResetEnabled } from '@/lib/auth/authFeatures';

const isPasswordResetEnabledMock = vi.mocked(isPasswordResetEnabled);
const isGoogleAuthEnabledMock = vi.mocked(isGoogleAuthEnabled);

afterEach(() => {
  isPasswordResetEnabledMock.mockReset();
  isPasswordResetEnabledMock.mockReturnValue(false);
  isGoogleAuthEnabledMock.mockReset();
  isGoogleAuthEnabledMock.mockReturnValue(false);
});

describe('mapAuthError', () => {
  it('maps duplicate signup when reset and Google are off', () => {
    expect(mapAuthError('User already registered')).toBe(
      'An account with this email already exists. Sign in.'
    );
  });

  it('maps duplicate signup when reset is on', () => {
    expect(mapAuthError('User already registered', { passwordResetEnabled: true })).toBe(
      'An account with this email already exists. Sign in or reset your password.'
    );
  });

  it('maps duplicate signup when Google is on', () => {
    expect(mapAuthError('User already registered', { googleAuthEnabled: true })).toBe(
      'An account with this email already exists. Sign in or Continue with Google.'
    );
  });

  it('maps duplicate signup when reset and Google are on', () => {
    expect(
      mapAuthError('User already registered', {
        passwordResetEnabled: true,
        googleAuthEnabled: true,
      })
    ).toBe(
      'An account with this email already exists. Sign in, reset your password, or Continue with Google.'
    );
  });

  it('maps invalid credentials when reset is off', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Email or password is wrong.');
  });

  it('maps invalid credentials when reset is on', () => {
    expect(mapAuthError('Invalid login credentials', { passwordResetEnabled: true })).toBe(
      'Email or password is wrong. Reset it if you forgot.'
    );
  });

  it('maps invalid credentials when Google is on', () => {
    expect(mapAuthError('Invalid login credentials', { googleAuthEnabled: true })).toBe(
      'Email or password is wrong. Or Continue with Google.'
    );
  });

  it('maps invalid credentials when reset and Google are on', () => {
    expect(
      mapAuthError('Invalid login credentials', {
        passwordResetEnabled: true,
        googleAuthEnabled: true,
      })
    ).toBe('Email or password is wrong. Reset it if you forgot, or Continue with Google.');
  });

  it('maps email not confirmed', () => {
    expect(mapAuthError('Email not confirmed')).toBe('Confirm your email, then sign in.');
  });

  it('maps Google cancel / access_denied', () => {
    expect(mapAuthError('access_denied')).toBe('Google sign-in was cancelled.');
    expect(mapAuthError('User cancelled login')).toBe('Google sign-in was cancelled.');
  });

  it('maps Google provider failures', () => {
    expect(mapAuthError('Unsupported provider: google')).toBe(
      'Google sign-in failed. Try again or use email and password.'
    );
    expect(mapAuthError('Unable to exchange external code')).toBe(
      'Google sign-in failed. Try again or use email and password.'
    );
  });

  it('passes unknown messages through', () => {
    expect(mapAuthError('Rate limit exceeded')).toBe('Rate limit exceeded');
  });

  it('reads flags when options omit them', () => {
    isPasswordResetEnabledMock.mockReturnValue(true);
    isGoogleAuthEnabledMock.mockReturnValue(true);
    expect(mapAuthError('Invalid login credentials')).toBe(
      'Email or password is wrong. Reset it if you forgot, or Continue with Google.'
    );
  });
});

describe('isDuplicateAccountError', () => {
  it('detects raw and mapped duplicate messages', () => {
    expect(isDuplicateAccountError('User already registered')).toBe(true);
    expect(isDuplicateAccountError('An account with this email already exists. Sign in.')).toBe(
      true
    );
    expect(isDuplicateAccountError('Invalid login credentials')).toBe(false);
  });
});
