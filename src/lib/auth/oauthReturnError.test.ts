import { describe, expect, it, vi } from 'vitest';
import {
  hasOAuthReturnErrorParams,
  readOAuthReturnError,
  stripOAuthReturnErrorParams,
} from './oauthReturnError';

vi.mock('@/lib/auth/authFeatures', () => ({
  isPasswordResetEnabled: () => false,
  isGoogleAuthEnabled: () => true,
}));

describe('oauthReturnError', () => {
  it('returns null when no error params are present', () => {
    expect(readOAuthReturnError(new URLSearchParams('c=invite'))).toBeNull();
    expect(hasOAuthReturnErrorParams(new URLSearchParams('c=invite'))).toBe(false);
  });

  it('maps error_description preferentially', () => {
    const params = new URLSearchParams(
      'error=access_denied&error_code=access_denied&error_description=User+cancelled+login'
    );
    expect(readOAuthReturnError(params)).toBe('Google sign-in was cancelled.');
    expect(hasOAuthReturnErrorParams(params)).toBe(true);
  });

  it('falls back to error when description is missing', () => {
    expect(readOAuthReturnError(new URLSearchParams('error=access_denied'))).toBe(
      'Google sign-in was cancelled.'
    );
  });

  it('strips OAuth error params and keeps other query keys', () => {
    const params = new URLSearchParams(
      'error=access_denied&error_description=nope&c=invite-1&m=mission-1'
    );
    expect(stripOAuthReturnErrorParams(params)).toBe('?c=invite-1&m=mission-1');
  });

  it('returns empty string when only OAuth error params were present', () => {
    expect(stripOAuthReturnErrorParams(new URLSearchParams('error=access_denied'))).toBe('');
  });
});
