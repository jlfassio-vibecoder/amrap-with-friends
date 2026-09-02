import { afterEach, describe, expect, it, vi } from 'vitest';

describe('isMagicLinkAuthEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to false when unset', async () => {
    vi.stubEnv('VITE_AUTH_MAGIC_LINK_ENABLED', '');
    const { isMagicLinkAuthEnabled } = await import('./authFeatures');
    expect(isMagicLinkAuthEnabled()).toBe(false);
  });

  it('returns false when explicitly disabled', async () => {
    vi.stubEnv('VITE_AUTH_MAGIC_LINK_ENABLED', 'false');
    vi.resetModules();
    const { isMagicLinkAuthEnabled } = await import('./authFeatures');
    expect(isMagicLinkAuthEnabled()).toBe(false);
  });

  it('returns true when explicitly enabled', async () => {
    vi.stubEnv('VITE_AUTH_MAGIC_LINK_ENABLED', 'true');
    vi.resetModules();
    const { isMagicLinkAuthEnabled } = await import('./authFeatures');
    expect(isMagicLinkAuthEnabled()).toBe(true);
  });
});

describe('isPasswordResetEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to false when unset', async () => {
    vi.stubEnv('VITE_AUTH_PASSWORD_RESET_ENABLED', '');
    const { isPasswordResetEnabled } = await import('./authFeatures');
    expect(isPasswordResetEnabled()).toBe(false);
  });

  it('returns true when explicitly enabled', async () => {
    vi.stubEnv('VITE_AUTH_PASSWORD_RESET_ENABLED', 'true');
    vi.resetModules();
    const { isPasswordResetEnabled } = await import('./authFeatures');
    expect(isPasswordResetEnabled()).toBe(true);
  });
});
