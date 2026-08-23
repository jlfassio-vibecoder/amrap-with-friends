import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createSession } from '@/lib/api/sessions';
import { getSupabaseConfigError } from '@/lib/supabase';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';

const DURATION_OPTIONS = [5, 15, 20] as const;

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Push-ups');
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
      const workout = parseWorkoutText(workoutText);
      const result = await createSession({
        nickname,
        durationMinutes,
        workout,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        navigate(`/session/${result.data.sessionId}`);
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
        <h1 className="text-display text-3xl text-ink">Create session</h1>
        <p className="text-sm text-secondary">
          Start an AMRAP session and invite friends to join.
        </p>
      </div>

      <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Your nickname</span>
          <input
            className="input-field"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Host nickname"
            maxLength={50}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Duration (minutes)</span>
          <select
            className="input-field"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Workout (one exercise per line)</span>
          <textarea
            className="input-field min-h-32"
            value={workoutText}
            onChange={(e) => setWorkoutText(e.target.value)}
            placeholder="10 Burpees&#10;Row 200m&#10;Squats"
            required
          />
        </label>

        {error && <p className="text-error">Error: {error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating…' : 'Create session'}
        </button>
      </form>

      <p className="text-sm">
        <Link className="link-accent" to="/join">Join an existing session</Link>
      </p>
    </main>
  );
}
