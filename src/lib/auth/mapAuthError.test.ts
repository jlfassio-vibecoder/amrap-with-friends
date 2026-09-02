import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDuplicateAccountError, mapAuthError } from './mapAuthError';

vi.mock('@/lib/auth/authFeatures', () => ({
  isPasswordResetEnabled: vi.fn(() => false),
}));

import { isPasswordResetEnabled } from '@/lib/auth/authFeatures';

const isPasswordResetEnabledMock = vi.mocked(isPasswordResetEnabled);

afterEach(() => {
  isPasswordResetEnabledMock.mockReset();
  isPasswordResetEnabledMock.mockReturnValue(false);
});

describe('mapAuthError', () => {
  it('maps duplicate signup when reset is off', () => {
    expect(mapAuthError('User already registered')).toBe(
      'An account with this email already exists. Sign in.'
    );
  });

  it('maps duplicate signup when reset is on', () => {
    expect(mapAuthError('User already registered', { passwordResetEnabled: true })).toBe(
      'An account with this email already exists. Sign in or reset your password.'
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

  it('maps email not confirmed', () => {
    expect(mapAuthError('Email not confirmed')).toBe('Confirm your email, then sign in.');
  });

  it('passes unknown messages through', () => {
    expect(mapAuthError('Rate limit exceeded')).toBe('Rate limit exceeded');
  });

  it('reads the password-reset flag when options omit it', () => {
    isPasswordResetEnabledMock.mockReturnValue(true);
    expect(mapAuthError('Invalid login credentials')).toBe(
      'Email or password is wrong. Reset it if you forgot.'
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
