import { describe, expect, it } from 'vitest';
import { isGuestOpenPath, shouldStayAfterSignup } from './guestOpenPaths';

describe('isGuestOpenPath', () => {
  it('recognizes join and live mission surfaces', () => {
    expect(isGuestOpenPath('/join')).toBe(true);
    expect(isGuestOpenPath('/mission/abc')).toBe(true);
    expect(isGuestOpenPath('/rally-point/abc')).toBe(true);
    expect(isGuestOpenPath('/campaign/join')).toBe(true);
    expect(isGuestOpenPath('/squad/join')).toBe(true);
  });

  it('rejects account history and home', () => {
    expect(isGuestOpenPath('/my-missions')).toBe(false);
    expect(isGuestOpenPath('/hud')).toBe(false);
    expect(isGuestOpenPath('/')).toBe(false);
  });
});

describe('shouldStayAfterSignup', () => {
  it('keeps athletes on My missions and HUD', () => {
    expect(shouldStayAfterSignup('/my-missions')).toBe(true);
    expect(shouldStayAfterSignup('/hud')).toBe(true);
  });

  it('does not stay on create or guest-open paths', () => {
    expect(shouldStayAfterSignup('/create')).toBe(false);
    expect(shouldStayAfterSignup('/join')).toBe(false);
    expect(shouldStayAfterSignup('/')).toBe(false);
  });
});
