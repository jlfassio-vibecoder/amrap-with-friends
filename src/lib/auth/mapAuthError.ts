const DUPLICATE_ACCOUNT_BASE = 'An account with this email already exists.';
const INVALID_CREDENTIALS_BASE = 'Email or password is wrong.';
const EMAIL_NOT_CONFIRMED = 'Confirm your email, then sign in.';
const GOOGLE_CANCELLED = 'Google sign-in was cancelled.';
const GOOGLE_FAILED = 'Google sign-in failed. Try again or use email and password.';

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

export interface MapAuthErrorOptions {
  passwordResetEnabled?: boolean;
  googleAuthEnabled?: boolean;
}

function duplicateAccountCopy(resetEnabled: boolean, googleEnabled: boolean): string {
  if (resetEnabled && googleEnabled) {
    return `${DUPLICATE_ACCOUNT_BASE} Sign in, reset your password, or Continue with Google.`;
  }
  if (resetEnabled) {
    return `${DUPLICATE_ACCOUNT_BASE} Sign in or reset your password.`;
  }
  if (googleEnabled) {
    return `${DUPLICATE_ACCOUNT_BASE} Sign in or Continue with Google.`;
  }
  return `${DUPLICATE_ACCOUNT_BASE} Sign in.`;
}

function invalidCredentialsCopy(resetEnabled: boolean, googleEnabled: boolean): string {
  if (resetEnabled && googleEnabled) {
    return `${INVALID_CREDENTIALS_BASE} Reset it if you forgot, or Continue with Google.`;
  }
  if (resetEnabled) {
    return `${INVALID_CREDENTIALS_BASE} Reset it if you forgot.`;
  }
  if (googleEnabled) {
    return `${INVALID_CREDENTIALS_BASE} Or Continue with Google.`;
  }
  return INVALID_CREDENTIALS_BASE;
}

function isGoogleCancelledMessage(normalized: string): boolean {
  return (
    normalized === 'access_denied' ||
    normalized.includes('access_denied') ||
    normalized.includes('user cancelled') ||
    normalized.includes('user canceled') ||
    normalized.includes('login cancelled') ||
    normalized.includes('login canceled')
  );
}

function isGoogleProviderFailure(normalized: string): boolean {
  return (
    normalized.includes('oauth') ||
    normalized.includes('provider is not enabled') ||
    normalized.includes('unsupported provider') ||
    normalized.startsWith('error exchanging') ||
    normalized.includes('unable to exchange external code')
  );
}

/**
 * Maps known GoTrue messages to athlete-facing copy.
 * Unknown messages pass through unchanged.
 */
export function mapAuthError(message: string, options: MapAuthErrorOptions = {}): string {
  const resetEnabled = options.passwordResetEnabled ?? false;
  const googleEnabled = options.googleAuthEnabled ?? false;
  const normalized = normalizeMessage(message);

  if (normalized === 'user already registered') {
    return duplicateAccountCopy(resetEnabled, googleEnabled);
  }

  if (normalized === 'invalid login credentials') {
    return invalidCredentialsCopy(resetEnabled, googleEnabled);
  }

  if (normalized === 'email not confirmed') {
    return EMAIL_NOT_CONFIRMED;
  }

  if (isGoogleCancelledMessage(normalized)) {
    return GOOGLE_CANCELLED;
  }

  if (isGoogleProviderFailure(normalized)) {
    return GOOGLE_FAILED;
  }

  return message;
}

/** True when the mapped (or raw) error means the email is already taken. */
export function isDuplicateAccountError(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (normalized === 'user already registered') {
    return true;
  }
  return normalizeMessage(
    mapAuthError(message, { passwordResetEnabled: false, googleAuthEnabled: false })
  ).startsWith(normalizeMessage(DUPLICATE_ACCOUNT_BASE));
}
