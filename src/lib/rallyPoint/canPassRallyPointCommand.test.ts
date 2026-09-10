import { describe, expect, it } from 'vitest';
import { canPassRallyPointCommand } from './canPassRallyPointCommand';

describe('canPassRallyPointCommand', () => {
  it('allows pass to an active claimed crewmate who is not self', () => {
    expect(canPassRallyPointCommand({ status: 'active', userId: 'user-b' }, 'user-a')).toBe(true);
  });

  it('refuses self, guests, left members, and missing self', () => {
    expect(canPassRallyPointCommand({ status: 'active', userId: 'user-a' }, 'user-a')).toBe(false);
    expect(canPassRallyPointCommand({ status: 'active', userId: null }, 'user-a')).toBe(false);
    expect(canPassRallyPointCommand({ status: 'left', userId: 'user-b' }, 'user-a')).toBe(false);
    expect(canPassRallyPointCommand({ status: 'active', userId: 'user-b' }, null)).toBe(false);
  });
});
