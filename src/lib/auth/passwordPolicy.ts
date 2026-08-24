/** Must match supabase/config.toml minimum_password_length and hosted dashboard Auth settings. */
export const AUTH_MIN_PASSWORD_LENGTH = 6;

export function validatePasswordLength(password: string):
  | { ok: true }
  | { ok: false; error: string } {
  if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  return { ok: true };
}
