/** Redirect after magic-link or confirmation email — stay on the current page. */
export function currentPathRedirectTo(
  location: Pick<Location, 'origin' | 'pathname'> = window.location
): string {
  return `${location.origin}${location.pathname}`;
}

/** Redirect after password-reset email — always the set-new-password page. */
export function passwordResetRedirectTo(
  location: Pick<Location, 'origin'> = window.location
): string {
  return `${location.origin}/reset-password`;
}
