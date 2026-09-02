import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLink } from '@/components/AppLink';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { AUTH_MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isAuthLoading,
    isPasswordRecovery,
    updatePassword,
    clearPasswordRecovery,
  } = useAmrapAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const canSetPassword = isAuthenticated && isPasswordRecovery;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSetPassword) {
      return;
    }

    setStatus('submitting');
    setMessage(null);

    const result = await updatePassword(password);
    if (result.error) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    clearPasswordRecovery();
    setStatus('success');
    setMessage('Password updated.');
    navigate('/intake', { replace: true });
  }

  if (isAuthLoading) {
    return (
      <NarrowPageLayout title="Reset password" subtitle="Account">
        <p className="text-sm text-secondary">Loading…</p>
      </NarrowPageLayout>
    );
  }

  if (!canSetPassword) {
    return (
      <NarrowPageLayout title="Reset password" subtitle="Account">
        <p className="text-sm text-secondary">Open the reset link from your email.</p>
        <p className="text-center text-sm">
          <AppLink className="link-accent" to="/">
            Back home
          </AppLink>
        </p>
      </NarrowPageLayout>
    );
  }

  const isBusy = status === 'submitting';

  return (
    <NarrowPageLayout title="Reset password" subtitle="Account">
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">New password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={AUTH_MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="input-field pr-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink disabled:opacity-50"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={isBusy}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="text-xs text-muted">
            At least {AUTH_MIN_PASSWORD_LENGTH} characters.
          </span>
        </label>

        {message ? (
          <p className={status === 'error' ? 'text-error' : 'text-sm text-secondary'}>{message}</p>
        ) : null}

        <button type="submit" className="btn-neutral w-full text-sm" disabled={isBusy}>
          {isBusy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </NarrowPageLayout>
  );
}
