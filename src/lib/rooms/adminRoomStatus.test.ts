import { describe, expect, it } from 'vitest';
import {
  adminRoomActionLabel,
  adminRoomState,
  adminRoomStatusLabel,
  foundingExpiry,
  type AdminRoomRow,
} from '@/lib/rooms/adminRoomStatus';

const base: AdminRoomRow = {
  roomId: 'r1',
  handle: 'coach_justin',
  displayName: 'AMRAP With Friends',
  createdAt: '2026-09-11T19:30:00.000Z',
  hostAccountId: 'h1',
  ownerEmail: 'coach@amrapwithfriends.com',
  memberCount: 1,
  isActive: false,
  entitlement: null,
};

const NOW = new Date('2026-09-11T20:00:00.000Z');

describe('adminRoomState', () => {
  it('separates a host never activated from one whose grant lapsed', () => {
    expect(adminRoomState(base)).toBe('never-granted');
    expect(
      adminRoomState({
        ...base,
        entitlement: { source: 'founding', expiresAt: '2026-01-01T00:00:00.000Z' },
      })
    ).toBe('expired');
  });

  it('is active when the room says so', () => {
    expect(adminRoomState({ ...base, isActive: true })).toBe('active');
  });
});

describe('adminRoomStatusLabel', () => {
  it('says missions are refused, not just "inactive"', () => {
    expect(adminRoomStatusLabel(base, NOW)).toContain('missions refused');
  });

  it('distinguishes never-activated from expired in words', () => {
    expect(adminRoomStatusLabel(base, NOW)).toContain('Never activated');
    expect(
      adminRoomStatusLabel(
        { ...base, entitlement: { source: 'founding', expiresAt: '2026-01-01T00:00:00.000Z' } },
        NOW
      )
    ).toContain('Expired');
  });

  it('stays quiet about an expiry that is far off', () => {
    expect(
      adminRoomStatusLabel(
        {
          ...base,
          isActive: true,
          entitlement: { source: 'founding', expiresAt: '2027-09-11T00:00:00.000Z' },
        },
        NOW
      )
    ).toBe('Active');
  });

  it('counts down only once it is close enough to act on', () => {
    expect(
      adminRoomStatusLabel(
        {
          ...base,
          isActive: true,
          entitlement: { source: 'founding', expiresAt: '2026-09-21T20:00:00.000Z' },
        },
        NOW
      )
    ).toBe('Active · expires in 10 days');
  });

  it('singularises the last day', () => {
    expect(
      adminRoomStatusLabel(
        {
          ...base,
          isActive: true,
          entitlement: { source: 'founding', expiresAt: '2026-09-12T20:00:00.000Z' },
        },
        NOW
      )
    ).toBe('Active · expires in 1 day');
  });
});

describe('adminRoomActionLabel', () => {
  it('offers nothing on an active room', () => {
    expect(adminRoomActionLabel({ ...base, isActive: true })).toBeNull();
  });

  it('names activation and renewal differently', () => {
    expect(adminRoomActionLabel(base)).toBe('Activate 12 months');
    expect(
      adminRoomActionLabel({
        ...base,
        entitlement: { source: 'founding', expiresAt: '2026-01-01T00:00:00.000Z' },
      })
    ).toBe('Renew 12 months');
  });
});

describe('foundingExpiry', () => {
  it('is twelve months out, and never null — the RPC rejects that', () => {
    expect(foundingExpiry(NOW)).toBe('2027-09-11T20:00:00.000Z');
  });
});
