import { useState, type FormEvent } from 'react';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAmrapAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    setMessage(null);

    const result = await signInWithMagicLink(email);
    if (result.error) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    setStatus('sent');
    setMessage('Check your email for a magic link to sign in.');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
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
            Sign in
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

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={status === 'sending' || status === 'sent'}
            />
          </label>

          {message && (
            <p className={status === 'error' ? 'text-error' : 'text-sm text-secondary'}>
              {status === 'error' ? `Error: ${message}` : message}
            </p>
          )}

          <button
            type="submit"
            className="btn-neutral w-full text-sm"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  );
}
