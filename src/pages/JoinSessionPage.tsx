import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { joinSession } from '@/lib/api/sessions';
import { getSupabaseConfigError } from '@/lib/supabase';

export default function JoinSessionPage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    setLoading(true);

    try {
      const result = await joinSession({
        sessionId,
        nickname,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        navigate(`/session/${sessionId.trim()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-display text-3xl text-ink">Join session</h1>
        <p className="text-sm text-secondary">
          Enter the session ID shared by your host.
        </p>
      </div>

      <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Session ID</span>
          <input
            className="input-field"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Paste session ID"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Your nickname</span>
          <input
            className="input-field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            maxLength={50}
            required
          />
        </label>

        {error && <p className="text-error">Error: {error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Joining…' : 'Join session'}
        </button>
      </form>

      <p className="text-sm">
        <Link className="link-accent" to="/create">Create a new session</Link>
      </p>
    </main>
  );
}
