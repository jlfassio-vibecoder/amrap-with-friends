/** Redirect after magic-link or confirmation email — stay on the current page (incl. query). */
export function currentPathRedirectTo(
  location: Pick<Location, 'origin' | 'pathname' | 'search'> = window.location
): string {
  return `${location.origin}${location.pathname}${location.search}`;
}

/** Redirect after password-reset email — always the set-new-password page. */
export function passwordResetRedirectTo(
  location: Pick<Location, 'origin'> = window.location
): string {
  return `${location.origin}/reset-password`;
}
