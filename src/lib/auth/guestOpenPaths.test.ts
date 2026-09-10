import { describe, expect, it } from 'vitest';
import { isGuestOpenPath } from './guestOpenPaths';

describe('isGuestOpenPath', () => {
  it('treats join and invite previews as guest-open', () => {
    expect(isGuestOpenPath('/join')).toBe(true);
    expect(isGuestOpenPath('/campaign/join')).toBe(true);
    expect(isGuestOpenPath('/squad/join')).toBe(true);
  });

  it('treats rally and mission routes as guest-open', () => {
    expect(isGuestOpenPath('/rally-point/abc')).toBe(true);
    expect(isGuestOpenPath('/mission/abc')).toBe(true);
  });

  it('does not treat gated app routes as guest-open', () => {
    expect(isGuestOpenPath('/create')).toBe(false);
    expect(isGuestOpenPath('/intake')).toBe(false);
    expect(isGuestOpenPath('/hud')).toBe(false);
    expect(isGuestOpenPath('/squad')).toBe(false);
    expect(isGuestOpenPath('/')).toBe(false);
  });
});
