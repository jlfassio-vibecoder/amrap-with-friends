import { beforeEach, describe, expect, it } from 'vitest';
import {
  PACING_GAUGE_STORAGE_KEY,
  readPacingGaugeEnabled,
  resetPacingGaugePrefs,
  writePacingGaugeEnabled,
} from '@/lib/pacing/pacingGaugePrefs';

beforeEach(() => {
  window.localStorage.clear();
  resetPacingGaugePrefs();
});

describe('pacingGaugePrefs', () => {
  it('is on for an athlete who has never chosen', () => {
    // A feature nobody can see is a feature nobody finds.
    expect(readPacingGaugeEnabled()).toBe(true);
  });

  it('remembers being turned off', () => {
    writePacingGaugeEnabled(false);
    expect(readPacingGaugeEnabled()).toBe(false);
    expect(window.localStorage.getItem(PACING_GAUGE_STORAGE_KEY)).toBe('false');
  });

  it('remembers being turned back on', () => {
    writePacingGaugeEnabled(false);
    writePacingGaugeEnabled(true);
    expect(readPacingGaugeEnabled()).toBe(true);
  });

  it('treats a stray stored value as on rather than hiding the gauge', () => {
    window.localStorage.setItem(PACING_GAUGE_STORAGE_KEY, 'yes');
    expect(readPacingGaugeEnabled()).toBe(true);
  });

  it('does not throw when storage is unavailable', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(() => writePacingGaugeEnabled(false)).not.toThrow();
      expect(readPacingGaugeEnabled()).toBe(false);
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    }
  });
});
