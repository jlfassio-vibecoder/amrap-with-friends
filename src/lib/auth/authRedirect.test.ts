import { describe, expect, it } from 'vitest';
import { currentPathRedirectTo, passwordResetRedirectTo } from './authRedirect';

describe('authRedirect', () => {
  it('builds current-path redirect from origin and pathname', () => {
    expect(
      currentPathRedirectTo({ origin: 'https://www.amrapwithfriends.com', pathname: '/create' })
    ).toBe('https://www.amrapwithfriends.com/create');
  });

  it('builds password-reset redirect', () => {
    expect(passwordResetRedirectTo({ origin: 'https://www.amrapwithfriends.com' })).toBe(
      'https://www.amrapwithfriends.com/reset-password'
    );
  });
});
