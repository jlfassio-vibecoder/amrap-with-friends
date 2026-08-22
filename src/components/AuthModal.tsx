import { useState, type FormEvent } from 'react';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAmrapAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-gray-300 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <h2 id="auth-modal-title" className="text-lg font-semibold">Sign in</h2>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Optional — play as a guest without signing in. Use an account to save sessions to your profile.
        </p>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border border-gray-300 px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={status === 'sending' || status === 'sent'}
            />
          </label>

          {message && (
            <p
              className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-gray-700'}`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  );
}
