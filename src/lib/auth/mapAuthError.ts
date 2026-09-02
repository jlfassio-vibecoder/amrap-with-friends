import { isPasswordResetEnabled } from '@/lib/auth/authFeatures';

const DUPLICATE_ACCOUNT_BASE = 'An account with this email already exists.';
const INVALID_CREDENTIALS_BASE = 'Email or password is wrong.';
const EMAIL_NOT_CONFIRMED = 'Confirm your email, then sign in.';

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

/**
 * Maps known GoTrue messages to athlete-facing copy.
 * Unknown messages pass through unchanged.
 */
export function mapAuthError(
  message: string,
  options: { passwordResetEnabled?: boolean } = {}
): string {
  const resetEnabled = options.passwordResetEnabled ?? isPasswordResetEnabled();
  const normalized = normalizeMessage(message);

  if (normalized === 'user already registered') {
    return resetEnabled
      ? `${DUPLICATE_ACCOUNT_BASE} Sign in or reset your password.`
      : `${DUPLICATE_ACCOUNT_BASE} Sign in.`;
  }

  if (normalized === 'invalid login credentials') {
    return resetEnabled
      ? `${INVALID_CREDENTIALS_BASE} Reset it if you forgot.`
      : INVALID_CREDENTIALS_BASE;
  }

  if (normalized === 'email not confirmed') {
    return EMAIL_NOT_CONFIRMED;
  }

  return message;
}

/** True when the mapped (or raw) error means the email is already taken. */
export function isDuplicateAccountError(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (normalized === 'user already registered') {
    return true;
  }
  return normalizeMessage(mapAuthError(message, { passwordResetEnabled: false })).startsWith(
    normalizeMessage(DUPLICATE_ACCOUNT_BASE)
  );
}
