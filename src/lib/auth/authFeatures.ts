function parseAuthEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return defaultValue;
}

/** When false, AuthModal hides magic link and only offers email + password. Off by default until custom SMTP exists. */
export function isMagicLinkAuthEnabled(): boolean {
  return parseAuthEnvBoolean(import.meta.env.VITE_AUTH_MAGIC_LINK_ENABLED, false);
}

/** When false, AuthForm hides Forgot password. Off by default until custom SMTP exists. */
export function isPasswordResetEnabled(): boolean {
  return parseAuthEnvBoolean(import.meta.env.VITE_AUTH_PASSWORD_RESET_ENABLED, false);
}

/** When false, AuthForm hides Continue with Google. Off until Google Cloud + Supabase Google provider are configured. */
export function isGoogleAuthEnabled(): boolean {
  return parseAuthEnvBoolean(import.meta.env.VITE_AUTH_GOOGLE_ENABLED, false);
}
