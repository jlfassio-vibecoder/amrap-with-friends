import { useEffect, useState, type FormEvent } from 'react';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  isGoogleAuthEnabled,
  isMagicLinkAuthEnabled,
  isPasswordResetEnabled,
} from '@/lib/auth/authFeatures';
import { isGuestOpenPath } from '@/lib/auth/guestOpenPaths';
import { isDuplicateAccountError } from '@/lib/auth/mapAuthError';
import { clearPostAuthPathIntent, setPostAuthPathIntent } from '@/lib/auth/postAuthDestination';
import {
  hasOAuthReturnErrorParams,
  readOAuthReturnError,
  stripOAuthReturnErrorParams,
} from '@/lib/auth/oauthReturnError';
import { AUTH_MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';

type AuthMethod = 'magic-link' | 'password';
export type PasswordMode = 'sign-in' | 'sign-up';
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
type AuthFormVariant = 'default' | 'compact';

function initialOAuthReturnFeedback(): { status: FormStatus; message: string | null } {
  if (typeof window === 'undefined' || !isGoogleAuthEnabled()) {
    return { status: 'idle', message: null };
  }

  const oauthError = readOAuthReturnError(new URLSearchParams(window.location.search), {
    passwordResetEnabled: isPasswordResetEnabled(),
    googleAuthEnabled: isGoogleAuthEnabled(),
  });
  if (!oauthError) {
    return { status: 'idle', message: null };
  }

  return { status: 'error', message: oauthError };
}

export interface AuthFormProps {
  /** Open on password Sign in or Create account. Defaults to sign-in. */
  initialPasswordMode?: PasswordMode;
  /**
   * False where an account is genuinely required (squad, campaigns), so the
   * form stops telling people signing in that it was optional.
   */
  guestAllowed?: boolean;
  /** Called when auth succeeds (modal uses this to close). Password sign-up waits for Continue. */
  onAuthenticated?: () => void;
  /** Called when Create account issued a session, before Continue — homepage holds the form. */
  onSignupSessionSuccess?: () => void;
  /** Render the Sign in / Create account heading (homepage inline). */
  showHeading?: boolean;
  /** When true (default), allow the secondary email-link control if magic link is enabled. Off for compact inline slots. */
  showAuthMethodSelector?: boolean;
  /** Heading id for modal aria-labelledby. Implies a heading row when set. */
  titleId?: string;
  /** Override the Sign in / Create account heading (Launch overlay). */
  heading?: string;
  /** Optional why-copy under the heading. */
  subtitle?: string;
  /** When set with titleId, show a Close control in the heading row. */
  onClose?: () => void;
  /** Tighter layout for inline homepage hero slot. Modal keeps default. */
  variant?: AuthFormVariant;
}

function passwordModeTabClass(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent'
    : 'rounded-full px-2.5 py-1 text-xs font-semibold text-secondary hover:text-ink';
}

function AuthPasswordModeToggle({
  value,
  onChange,
}: {
  value: PasswordMode;
  onChange: (mode: PasswordMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-page p-0.5"
      role="tablist"
      aria-label="Account action"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'sign-in'}
        className={passwordModeTabClass(value === 'sign-in')}
        onClick={() => onChange('sign-in')}
      >
        Sign in
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'sign-up'}
        className={passwordModeTabClass(value === 'sign-up')}
        onClick={() => onChange('sign-up')}
      >
        Create account
      </button>
    </div>
  );
}

export function AuthForm({
  initialPasswordMode = 'sign-in',
  guestAllowed = true,
  onAuthenticated,
  onSignupSessionSuccess,
  showHeading = false,
  showAuthMethodSelector = true,
  titleId,
  heading,
  subtitle,
  onClose,
  variant = 'default',
}: AuthFormProps) {
  const isCompact = variant === 'compact';
  const magicLinkEnabled = isMagicLinkAuthEnabled();
  const passwordResetEnabled = isPasswordResetEnabled();
  const googleAuthEnabled = isGoogleAuthEnabled();
  const {
    signInWithMagicLink,
    signInWithGoogle,
    signUpWithPassword,
    signInWithPassword,
    requestPasswordReset,
  } = useAmrapAuth();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>(initialPasswordMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<FormStatus>(() => initialOAuthReturnFeedback().status);
  const [message, setMessage] = useState<string | null>(() => initialOAuthReturnFeedback().message);
  const [awaitingSignupContinue, setAwaitingSignupContinue] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Strip OAuth error query params after paint — state already seeded from the URL above.
  useEffect(() => {
    if (!googleAuthEnabled || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!hasOAuthReturnErrorParams(params)) {
      return;
    }

    const nextSearch = stripOAuthReturnErrorParams(params);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch}${window.location.hash}`
    );
  }, [googleAuthEnabled]);

  function resetFeedback() {
    setStatus('idle');
    setMessage(null);
    setAwaitingSignupContinue(false);
  }

  function switchAuthMethod(method: AuthMethod) {
    setAuthMethod(method);
    setPassword('');
    setShowPassword(false);
    resetFeedback();
  }

  function switchPasswordMode(mode: PasswordMode) {
    setPasswordMode(mode);
    resetFeedback();
  }

  async function handleMagicLinkSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);

    const result = await signInWithMagicLink(email);
    if (result.error) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    setStatus('success');
    setMessage('Check your email for a magic link to sign in.');
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);

    if (passwordMode === 'sign-up') {
      const result = await signUpWithPassword(email, password);
      if (result.error) {
        setStatus('error');
        setMessage(result.error);
        if (isDuplicateAccountError(result.error)) {
          setPasswordMode('sign-in');
        }
        return;
      }

      if (result.needsEmailConfirmation) {
        setStatus('success');
        setMessage('Check your email to confirm your account, then sign in.');
        return;
      }

      setStatus('success');
      setMessage("You're signed in.");
      setAwaitingSignupContinue(true);
      onSignupSessionSuccess?.();
      return;
    }

    const result = await signInWithPassword(email, password);
    if (result.error) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    setStatus('success');
    setMessage(null);
    onAuthenticated?.();
  }

  const isBusy = status === 'submitting';

  async function handleForgotPassword() {
    if (!passwordResetEnabled || resetBusy || isBusy) {
      return;
    }

    setResetBusy(true);
    setStatus('submitting');
    setMessage(null);

    const result = await requestPasswordReset(email);
    setResetBusy(false);

    if (result.error) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    setStatus('success');
    setMessage('Check your email for a reset link.');
  }

  async function handleGoogleSignIn() {
    if (!googleAuthEnabled || isBusy || awaitingSignupContinue) {
      return;
    }

    if (passwordMode === 'sign-up' && !isGuestOpenPath(window.location.pathname)) {
      setPostAuthPathIntent('/create');
    } else {
      clearPostAuthPathIntent();
    }

    setStatus('submitting');
    setMessage(null);

    const result = await signInWithGoogle();
    if (result.error) {
      setStatus('error');
      setMessage(result.error);
    }
    // On success the browser navigates to Google — leave submitting state.
  }

  const isSuccessLocked = status === 'success' && authMethod === 'magic-link';
  const passwordFieldsLocked = isBusy || (status === 'success' && !awaitingSignupContinue);
  const showingPasswordForm = !(magicLinkEnabled && authMethod === 'magic-link');
  const title =
    heading ?? (showingPasswordForm && passwordMode === 'sign-up' ? 'Create account' : 'Sign in');
  const showTitleRow = showHeading || titleId !== undefined || heading !== undefined;
  const formSpacing = isCompact
    ? 'space-y-2'
    : showTitleRow || guestAllowed || (showAuthMethodSelector && magicLinkEnabled)
      ? 'space-y-4'
      : 'space-y-3';
  const passwordFormSpacing = isCompact ? 'space-y-2' : 'space-y-3';
  const inputClass = isCompact ? 'input-field-compact' : 'input-field';
  const submitClass = isCompact
    ? 'btn-neutral w-full py-1.5 text-sm'
    : 'btn-neutral w-full text-sm';
  const googleButtonClass = isCompact
    ? 'btn-outline w-full py-1.5 text-sm font-semibold'
    : 'btn-outline w-full text-sm font-semibold';

  return (
    <div className={formSpacing}>
      {showTitleRow ? (
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-display text-xl text-ink">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              className="text-sm text-secondary hover:text-ink"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </button>
          ) : null}
        </div>
      ) : null}

      {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}

      {guestAllowed ? (
        <p className="text-sm text-secondary">
          Optional — play as a guest without signing in. Use an account to save missions to your
          profile.
        </p>
      ) : null}

      {googleAuthEnabled && !awaitingSignupContinue && showingPasswordForm ? (
        <div className={passwordFormSpacing}>
          <button
            type="button"
            className={googleButtonClass}
            disabled={isBusy}
            onClick={() => void handleGoogleSignIn()}
          >
            {isBusy ? 'Continuing…' : 'Continue with Google'}
          </button>
          <p
            className={
              isCompact ? 'text-center text-xs text-muted' : 'text-center text-sm text-muted'
            }
          >
            or
          </p>
        </div>
      ) : null}

      {magicLinkEnabled && authMethod === 'magic-link' ? (
        <form className={passwordFormSpacing} onSubmit={handleMagicLinkSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy || isSuccessLocked}
            />
          </label>

          {message ? (
            <p className={status === 'error' ? 'text-error' : 'text-sm text-secondary'}>
              {message}
            </p>
          ) : null}

          <button type="submit" className={submitClass} disabled={isBusy || isSuccessLocked}>
            {isBusy ? 'Sending…' : 'Send magic link'}
          </button>

          {showAuthMethodSelector ? (
            <button
              type="button"
              className="link-accent text-sm"
              disabled={isBusy || isSuccessLocked}
              onClick={() => switchAuthMethod('password')}
            >
              Use password instead
            </button>
          ) : null}
        </form>
      ) : (
        <form className={passwordFormSpacing} onSubmit={handlePasswordSubmit}>
          {isCompact ? (
            <AuthPasswordModeToggle
              value={passwordMode}
              onChange={awaitingSignupContinue ? () => undefined : switchPasswordMode}
            />
          ) : (
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                className={
                  passwordMode === 'sign-in' ? 'font-semibold text-ink underline' : 'link-accent'
                }
                disabled={awaitingSignupContinue}
                onClick={() => switchPasswordMode('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={
                  passwordMode === 'sign-up' ? 'font-semibold text-ink underline' : 'link-accent'
                }
                disabled={awaitingSignupContinue}
                onClick={() => switchPasswordMode('sign-up')}
              >
                Create account
              </button>
            </div>
          )}

          <label className={isCompact ? 'block' : 'block space-y-1 text-sm'}>
            <span className={isCompact ? 'sr-only' : 'font-semibold'}>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder={isCompact ? 'Email' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={passwordFieldsLocked}
            />
          </label>

          <label className={isCompact ? 'block' : 'block space-y-1 text-sm'}>
            <span className={isCompact ? 'sr-only' : 'font-semibold'}>Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                autoComplete={passwordMode === 'sign-up' ? 'new-password' : 'current-password'}
                className={`${inputClass} pr-10`}
                placeholder={
                  isCompact ? `Password (${AUTH_MIN_PASSWORD_LENGTH}+ characters)` : undefined
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={passwordFieldsLocked}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isBusy}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M1 1l22 22" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {isCompact ? null : (
              <span className="text-xs text-muted">
                At least {AUTH_MIN_PASSWORD_LENGTH} characters.
              </span>
            )}
          </label>

          {passwordResetEnabled && passwordMode === 'sign-in' && !awaitingSignupContinue ? (
            <div className="text-sm">
              <button
                type="button"
                className="link-accent"
                disabled={isBusy || resetBusy || email.trim().length === 0}
                onClick={() => void handleForgotPassword()}
              >
                Forgot password?
              </button>
            </div>
          ) : null}

          {message ? (
            <div className={status === 'error' ? 'text-error' : 'space-y-1 text-sm text-secondary'}>
              <p>{message}</p>
              {awaitingSignupContinue ? (
                <p>Reveal the password if you need it on another device.</p>
              ) : null}
            </div>
          ) : null}

          {awaitingSignupContinue ? (
            <button type="button" className={submitClass} onClick={() => onAuthenticated?.()}>
              Continue
            </button>
          ) : (
            <button type="submit" className={submitClass} disabled={isBusy || status === 'success'}>
              {isBusy ? 'Submitting…' : passwordMode === 'sign-up' ? 'Create account' : 'Sign in'}
            </button>
          )}

          {showAuthMethodSelector && magicLinkEnabled && !awaitingSignupContinue ? (
            <button
              type="button"
              className="link-accent text-sm"
              disabled={isBusy || status === 'success'}
              onClick={() => switchAuthMethod('magic-link')}
            >
              Use an email link instead
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
