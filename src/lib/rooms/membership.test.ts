import { describe, it, expect } from 'vitest';
import { canRunRoom, capabilitiesFor, isRoomHost } from './membership';

describe('capabilitiesFor', () => {
  it('gives the owner everything except leaving', () => {
    const owner = capabilitiesFor('owner');
    expect(owner).toEqual({
      runRoom: true,
      manageCohosts: true,
      manageBilling: true,
      seeEarnings: true,
      editIdentity: true,
      leave: false,
    });
  });

  // The boundary the plan draws twice: co-hosts run the room, never the money.
  it('lets a co-host run the room and nothing financial', () => {
    const cohost = capabilitiesFor('cohost');
    expect(cohost.runRoom).toBe(true);
    expect(cohost.manageBilling).toBe(false);
    expect(cohost.seeEarnings).toBe(false);
    expect(cohost.manageCohosts).toBe(false);
    expect(cohost.editIdentity).toBe(false);
  });

  it('gives a member nothing but the door', () => {
    expect(capabilitiesFor('member')).toEqual({
      runRoom: false,
      manageCohosts: false,
      manageBilling: false,
      seeEarnings: false,
      editIdentity: false,
      leave: true,
    });
  });

  // A revoked co-host is null here, and null must not inherit anything.
  it('gives a non-member nothing at all', () => {
    for (const role of [null, undefined] as const) {
      const caps = capabilitiesFor(role);
      expect(Object.values(caps).every((v) => v === false)).toBe(true);
    }
  });

  it('never lets an owner leave, because that would be a transfer', () => {
    expect(capabilitiesFor('owner').leave).toBe(false);
  });

  it('only the owner sees earnings', () => {
    const seers = (['owner', 'cohost', 'member', null] as const).filter(
      (role) => capabilitiesFor(role).seeEarnings
    );
    expect(seers).toEqual(['owner']);
  });
});

describe('canRunRoom / isRoomHost', () => {
  it('tracks the capability, including for a revoked co-host', () => {
    expect(canRunRoom('owner')).toBe(true);
    expect(canRunRoom('cohost')).toBe(true);
    expect(canRunRoom('member')).toBe(false);
    expect(canRunRoom(null)).toBe(false);
  });

  it('counts owner and co-host as hosts', () => {
    expect(isRoomHost('owner')).toBe(true);
    expect(isRoomHost('cohost')).toBe(true);
    expect(isRoomHost('member')).toBe(false);
    expect(isRoomHost(null)).toBe(false);
  });
});
