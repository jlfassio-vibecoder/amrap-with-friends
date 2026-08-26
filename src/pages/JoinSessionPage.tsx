import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { HostScheduledSessionsPanel } from '@/components/session/HostScheduledSessionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import {
  isSessionIdUuid,
  joinSession,
  mapDeepLinkJoinError,
  SESSION_LOCKED_OR_INVALID,
} from '@/lib/api/sessions';
import { callsignFromEmail } from '@/lib/sessionIdentity';
import { getSupabaseConfigError } from '@/lib/supabase';
import { unlockTacticalAudio } from '@/lib/audio/tacticalSynthesis';
import { track } from '@/lib/analytics/track';

export default function JoinSessionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rallyParam = params.get('s');
  const deepLink = rallyParam !== null;
  const rallySessionId = rallyParam?.trim() ?? '';
  const rallyUuidValid = deepLink && isSessionIdUuid(rallySessionId);

  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const authCallsign = callsignFromEmail(user?.email);
  const canAutoJoin = deepLink && rallyUuidValid && isAuthenticated && !!authCallsign;

  const [sessionId, setSessionId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(
    deepLink && !rallyUuidValid ? SESSION_LOCKED_OR_INVALID : null
  );
  const [loading, setLoading] = useState(false);
  const autoJoinedSessionIdRef = useRef<string | null>(null);

  async function performJoin(targetSessionId: string, callsign: string, deep: boolean) {
    setError(null);

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    setLoading(true);
    try {
      const result = await joinSession({
        sessionId: targetSessionId,
        nickname: callsign,
      });

      if (result.error) {
        setError(
          deep ? mapDeepLinkJoinError(result.error.message) : result.error.message
        );
        return;
      }

      if (result.data) {
        track(
          'session_joined',
          { deep_link: deep, auth: isAuthenticated },
          {
            userId: user?.id ?? null,
            sessionId: targetSessionId.trim(),
            participantId: result.data.participantId,
          }
        );
        navigate(`/session/${targetSessionId.trim()}`);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(deep ? mapDeepLinkJoinError(message) : message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAutoJoin || isAuthLoading || !authCallsign) {
      return;
    }
    if (autoJoinedSessionIdRef.current === rallySessionId) {
      return;
    }
    autoJoinedSessionIdRef.current = rallySessionId;
    void performJoin(rallySessionId, authCallsign, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-join per rally session id
  }, [canAutoJoin, isAuthLoading, authCallsign, rallySessionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    unlockTacticalAudio();
    if (deepLink) {
      if (!rallyUuidValid) {
        setError(SESSION_LOCKED_OR_INVALID);
        return;
      }
      await performJoin(rallySessionId, nickname || authCallsign || '', true);
      return;
    }
    await performJoin(sessionId, nickname, false);
  }

  if (deepLink && !rallyUuidValid) {
    return (
      <NarrowPageLayout title="Join session" subtitle="Rally point">
        <p className="text-error">{SESSION_LOCKED_OR_INVALID}</p>
        <p className="text-center text-sm">
          <Link className="link-accent" to="/join">
            Enter a session ID manually
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  if (deepLink && isAuthLoading) {
    return (
      <NarrowPageLayout title="Join session" subtitle="Rally point">
        <p className="text-sm text-secondary">Checking identity…</p>
      </NarrowPageLayout>
    );
  }

  if (deepLink && canAutoJoin && !error) {
    return (
      <NarrowPageLayout title="Join session" subtitle="Rally point">
        <p className="text-sm text-secondary">
          Welcome, {authCallsign}. Breaching lobby…
        </p>
        {loading ? <p className="text-sm text-secondary">Joining…</p> : null}
      </NarrowPageLayout>
    );
  }

  if (deepLink) {
    return (
      <NarrowPageLayout title="Join session" subtitle="Rally point">
        <p className="text-sm text-secondary lg:hidden">
          Enter a temporary callsign to breach the lobby. No account required.
        </p>
        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">Rally point</h1>
          <p className="text-sm text-secondary">
            Enter a temporary callsign to breach the lobby. No account required.
          </p>
        </div>

        <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wide">
              Enter temporary callsign
            </span>
            <input
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={authCallsign ?? 'Callsign'}
              maxLength={50}
              required
              autoFocus
            />
          </label>

          {error ? <p className="text-error">{error}</p> : null}

          <button type="submit" className="btn-primary w-full uppercase tracking-widest" disabled={loading}>
            {loading ? 'Joining…' : 'Breach lobby'}
          </button>
        </form>

        <HostScheduledSessionsPanel />

        <p className="text-center text-sm">
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </p>
      </NarrowPageLayout>
    );
  }

  return (
    <NarrowPageLayout title="Join session" subtitle="Enter a session ID">
      <p className="text-sm text-secondary lg:hidden">
        Enter the session ID shared by your host.
      </p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">Join session</h1>
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

      <HostScheduledSessionsPanel />

      <p className="text-center text-sm">
        <Link className="link-accent" to="/create">Create a new session</Link>
      </p>
    </NarrowPageLayout>
  );
}
