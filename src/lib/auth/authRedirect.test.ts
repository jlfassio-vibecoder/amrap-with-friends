import { describe, expect, it } from 'vitest';
import { currentPathRedirectTo, passwordResetRedirectTo } from './authRedirect';

describe('authRedirect', () => {
  it('builds current-path redirect from origin and pathname', () => {
    expect(
      currentPathRedirectTo({
        origin: 'https://www.amrapwithfriends.com',
        pathname: '/create',
        search: '',
      })
    ).toBe('https://www.amrapwithfriends.com/create');
  });

  it('preserves invite query params on the current-path redirect', () => {
    expect(
      currentPathRedirectTo({
        origin: 'https://www.amrapwithfriends.com',
        pathname: '/campaign/join',
        search: '?c=invite123',
      })
    ).toBe('https://www.amrapwithfriends.com/campaign/join?c=invite123');
  });

  it('builds password-reset redirect', () => {
    expect(passwordResetRedirectTo({ origin: 'https://www.amrapwithfriends.com' })).toBe(
      'https://www.amrapwithfriends.com/reset-password'
    );
  });
});
