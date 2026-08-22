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
        <h1 className="text-2xl font-semibold">Join session</h1>
        <p className="text-sm text-gray-600">Enter the session ID shared by your host.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Session ID</span>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Paste session ID"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Your nickname</span>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            maxLength={50}
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Joining…' : 'Join session'}
        </button>
      </form>

      <p className="text-sm">
        <Link to="/create">Create a new session</Link>
      </p>
    </main>
  );
}
