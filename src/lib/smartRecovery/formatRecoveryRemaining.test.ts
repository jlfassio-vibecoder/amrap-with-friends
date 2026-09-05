import { describe, expect, it } from 'vitest';
import type { TemplateRecoveryLock } from './computeRecoveryLocks';
import { formatRecoveryLockMessage, formatRecoveryRemaining } from './formatRecoveryRemaining';

const NOW = new Date('2026-09-01T12:00:00.000Z');

describe('formatRecoveryRemaining', () => {
  it('formats multi-day remaining time', () => {
    const expiresAt = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    expect(formatRecoveryRemaining(expiresAt, NOW)).toBe('2d remaining');
  });

  it('formats hour remaining time under one day', () => {
    const expiresAt = new Date(NOW.getTime() + 23 * 60 * 60 * 1000);
    expect(formatRecoveryRemaining(expiresAt, NOW)).toBe('23h remaining');
  });

  it('formats exactly twenty-four hours as one day', () => {
    const expiresAt = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(formatRecoveryRemaining(expiresAt, NOW)).toBe('1d remaining');
  });

  it('rounds sub-hour remaining up to one hour', () => {
    const expiresAt = new Date(NOW.getTime() + 30 * 60 * 1000);
    expect(formatRecoveryRemaining(expiresAt, NOW)).toBe('1h remaining');
  });

  it('returns zero-hour copy when the lock has expired', () => {
    expect(formatRecoveryRemaining(NOW, NOW)).toBe('0h remaining');
  });
});

describe('formatRecoveryLockMessage', () => {
  function lock(
    overrides: Partial<TemplateRecoveryLock> & Pick<TemplateRecoveryLock, 'reason' | 'expiresAt'>
  ): TemplateRecoveryLock {
    return {
      templateId: 'the-piston',
      ...overrides,
    };
  }

  it('formats exact-match copy', () => {
    expect(
      formatRecoveryLockMessage(
        lock({
          reason: 'exact-match',
          expiresAt: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000),
        }),
        NOW
      )
    ).toBe('Recovery lock: same workout — 2d remaining');
  });

  it('formats severe-intensity copy', () => {
    expect(
      formatRecoveryLockMessage(
        lock({
          reason: 'severe-intensity',
          expiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
        }),
        NOW
      )
    ).toBe('Recovery lock: CNS recovery — 12h remaining');
  });

  it('formats movement-pattern copy with the pattern label', () => {
    expect(
      formatRecoveryLockMessage(
        lock({
          reason: 'movement-pattern',
          pattern: 'upper-push',
          expiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
        }),
        NOW
      )
    ).toBe('Recovery lock: Upper body push — 6h remaining');
  });
});
