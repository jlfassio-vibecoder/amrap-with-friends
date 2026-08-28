import { useEffect, useState, type FormEvent } from 'react';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { isMagicLinkAuthEnabled } from '@/lib/auth/authFeatures';
import { AUTH_MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';

type AuthMethod = 'magic-link' | 'password';
type PasswordMode = 'sign-in' | 'sign-up';
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface AuthModalProps {
  onClose: () => void;
  /** Open on password Sign in or Create account. Defaults to sign-in. */
  initialPasswordMode?: PasswordMode;
}

function authMethodButtonClass(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent'
    : 'rounded-full px-4 py-2 text-sm font-semibold text-secondary hover:text-ink';
}

export function AuthModal({
  onClose,
  initialPasswordMode = 'sign-in',
}: AuthModalProps) {
  const magicLinkEnabled = isMagicLinkAuthEnabled();
  const {
    signInWithMagicLink,
    signUpWithPassword,
    signInWithPassword,
    isAuthenticated,
  } = useAmrapAuth();

  const [authMethod, setAuthMethod] = useState<AuthMethod>(() => {
    if (initialPasswordMode === 'sign-up') {
      return 'password';
    }
    return magicLinkEnabled ? 'magic-link' : 'password';
  });
  const [passwordMode, setPasswordMode] = useState<PasswordMode>(initialPasswordMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
  }, [isAuthenticated, onClose]);

  function resetFeedback() {
    setStatus('idle');
    setMessage(null);
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
        return;
      }

      if (result.needsEmailConfirmation) {
        setStatus('success');
        setMessage('Check your email to confirm your account, then sign in.');
        return;
      }

      setStatus('success');
      setMessage('Account created.');
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
  }

  const isBusy = status === 'submitting';
  const isSuccessLocked = status === 'success' && authMethod === 'magic-link';
  const showingPasswordForm = !(magicLinkEnabled && authMethod === 'magic-link');
  const title =
    showingPasswordForm && passwordMode === 'sign-up' ? 'Create account' : 'Sign in';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="auth-modal-title" className="text-display text-xl text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="text-sm text-secondary hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <p className="text-sm text-secondary">
          Optional — play as a guest without signing in. Use an account to save sessions to your profile.
        </p>

        {magicLinkEnabled ? (
          <div
            className="inline-flex rounded-full border border-border bg-page p-1"
            role="tablist"
            aria-label="Sign-in method"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'magic-link'}
              className={authMethodButtonClass(authMethod === 'magic-link')}
              onClick={() => switchAuthMethod('magic-link')}
            >
              Magic link
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'password'}
              className={authMethodButtonClass(authMethod === 'password')}
              onClick={() => switchAuthMethod('password')}
            >
              Password
            </button>
          </div>
        ) : (
          <div className="inline-flex rounded-full border border-border bg-page p-1">
            <span className="rounded-full px-4 py-2 text-sm font-semibold text-ink">
              Email and password
            </span>
          </div>
        )}

        {magicLinkEnabled && authMethod === 'magic-link' ? (
          <form className="space-y-3" onSubmit={handleMagicLinkSubmit}>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="input-field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy || isSuccessLocked}
              />
            </label>

            {message ? (
              <p className={status === 'error' ? 'text-error' : 'text-sm text-secondary'}>
                {status === 'error' ? `Error: ${message}` : message}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-neutral w-full text-sm"
              disabled={isBusy || isSuccessLocked}
            >
              {isBusy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handlePasswordSubmit}>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                className={
                  passwordMode === 'sign-in'
                    ? 'font-semibold text-ink underline'
                    : 'link-accent'
                }
                onClick={() => switchPasswordMode('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={
                  passwordMode === 'sign-up'
                    ? 'font-semibold text-ink underline'
                    : 'link-accent'
                }
                onClick={() => switchPasswordMode('sign-up')}
              >
                Create account
              </button>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="input-field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy || status === 'success'}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={AUTH_MIN_PASSWORD_LENGTH}
                  autoComplete={
                    passwordMode === 'sign-up' ? 'new-password' : 'current-password'
                  }
                  className="input-field pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isBusy || status === 'success'}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isBusy || status === 'success'}
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
              <span className="text-xs text-muted">
                At least {AUTH_MIN_PASSWORD_LENGTH} characters.
              </span>
            </label>

            {message ? (
              <p className={status === 'error' ? 'text-error' : 'text-sm text-secondary'}>
                {status === 'error' ? `Error: ${message}` : message}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-neutral w-full text-sm"
              disabled={isBusy || status === 'success'}
            >
              {isBusy
                ? 'Submitting…'
                : passwordMode === 'sign-up'
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
