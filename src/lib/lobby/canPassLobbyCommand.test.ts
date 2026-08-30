import { describe, expect, it } from 'vitest';
import { canPassLobbyCommand } from './canPassLobbyCommand';

describe('canPassLobbyCommand', () => {
  it('allows pass to an active claimed crewmate who is not self', () => {
    expect(canPassLobbyCommand({ status: 'active', userId: 'user-b' }, 'user-a')).toBe(true);
  });

  it('refuses self, guests, left members, and missing self', () => {
    expect(canPassLobbyCommand({ status: 'active', userId: 'user-a' }, 'user-a')).toBe(false);
    expect(canPassLobbyCommand({ status: 'active', userId: null }, 'user-a')).toBe(false);
    expect(canPassLobbyCommand({ status: 'left', userId: 'user-b' }, 'user-a')).toBe(false);
    expect(canPassLobbyCommand({ status: 'active', userId: 'user-b' }, null)).toBe(false);
  });
});
