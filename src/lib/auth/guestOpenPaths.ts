/**
 * Paths where guests can train without an account or intake.
 * Header Create account must not yank athletes off these routes.
 */
export function isGuestOpenPath(pathname: string): boolean {
  if (pathname === '/join' || pathname === '/campaign/join' || pathname === '/squad/join') {
    return true;
  }

  if (/^\/rally-point\/[^/]+$/.test(pathname)) {
    return true;
  }

  if (/^\/mission\/[^/]+$/.test(pathname)) {
    return true;
  }

  return false;
}

/**
 * Account surfaces where Create account / Google sign-up should leave the
 * athlete on the current page instead of sending them to /create.
 */
export function shouldStayAfterSignup(pathname: string): boolean {
  return pathname === '/my-missions' || pathname === '/hud';
}
