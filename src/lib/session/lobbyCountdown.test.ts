import { describe, expect, it } from 'vitest';
import {
  formatTMinus,
  remainingLobbyCountdownSec,
} from './lobbyCountdown';

describe('lobbyCountdown', () => {
  it('returns null when endsAt is missing or invalid', () => {
    expect(remainingLobbyCountdownSec(null, Date.now())).toBeNull();
    expect(remainingLobbyCountdownSec(undefined, Date.now())).toBeNull();
    expect(remainingLobbyCountdownSec('not-a-date', Date.now())).toBeNull();
  });

  it('clamps remaining seconds at zero and ceilings fractional seconds', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    expect(
      remainingLobbyCountdownSec('2026-08-25T12:00:00.400Z', now)
    ).toBe(1);
    expect(
      remainingLobbyCountdownSec('2026-08-25T12:00:05.000Z', now)
    ).toBe(5);
    expect(
      remainingLobbyCountdownSec('2026-08-25T11:59:50.000Z', now)
    ).toBe(0);
  });

  it('formats T-MINUS MM:SS', () => {
    expect(formatTMinus(299)).toBe('T-MINUS 04:59');
    expect(formatTMinus(0)).toBe('T-MINUS 00:00');
    expect(formatTMinus(600)).toBe('T-MINUS 10:00');
  });
});
