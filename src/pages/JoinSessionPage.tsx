import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NarrowPageLayout } from '@/components/NarrowPageLayout';
import { HostScheduledSessionsPanel } from '@/components/session/HostScheduledSessionsPanel';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { resumeSessionIdentity } from '@/lib/api/resumeSessionIdentity';
import {
  isSessionIdUuid,
  joinSession,
  mapDeepLinkJoinError,
  SESSION_LOCKED_OR_INVALID,
} from '@/lib/api/sessions';
import {
  isRallyPointIdUuid,
  joinRallyPoint,
  isLiveRallyPointSessionState,
} from '@/lib/api/rallyPoint';
import { callsignFromEmail } from '@/lib/sessionIdentity';
import { getSupabaseConfigError } from '@/lib/supabase';
import { unlockTacticalAudio } from '@/lib/audio/tacticalSynthesis';
import { track } from '@/lib/analytics/track';

export default function JoinSessionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rallyParam = params.get('s');
  const rallyPointParam = params.get('r');
  const rallyPointDeepLink = rallyPointParam !== null;
  const rallyDeepLink = rallyParam !== null && !rallyPointDeepLink;
  const deepLink = rallyDeepLink || rallyPointDeepLink;
  const rallySessionId = rallyParam?.trim() ?? '';
  const rallyPointId = rallyPointParam?.trim() ?? '';
  const rallyUuidValid = rallyDeepLink && isSessionIdUuid(rallySessionId);
  const rallyPointUuidValid = rallyPointDeepLink && isRallyPointIdUuid(rallyPointId);

  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const authCallsign = callsignFromEmail(user?.email);
  const canAutoJoinSession = rallyDeepLink && rallyUuidValid && isAuthenticated && !!authCallsign;
  const canAutoJoinRallyPoint =
    rallyPointDeepLink && rallyPointUuidValid && isAuthenticated && !!authCallsign;

  const [sessionId, setSessionId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(
    (rallyDeepLink && !rallyUuidValid) || (rallyPointDeepLink && !rallyPointUuidValid)
      ? SESSION_LOCKED_OR_INVALID
      : null
  );
  const [loading, setLoading] = useState(false);
  const autoJoinedSessionIdRef = useRef<string | null>(null);
  const autoJoinedRallyPointIdRef = useRef<string | null>(null);

  async function performRallyPointJoin(targetRallyPointId: string, callsign: string) {
    setError(null);
    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }
    setLoading(true);
    try {
      const result = await joinRallyPoint({ rallyPointId: targetRallyPointId, nickname: callsign });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data?.sessionId && isLiveRallyPointSessionState(result.data.sessionState)) {
        navigate(`/session/${result.data.sessionId}`);
        return;
      }
      navigate(`/rally-point/${targetRallyPointId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function performJoin(targetSessionId: string, callsign: string, deep: boolean) {
    setError(null);

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    setLoading(true);
    try {
      // Authenticated reclaim first: Featured WOD / prior claim already has a
      // participants row with user_id — avoid inserting a duplicate joiner.
      if (isAuthenticated) {
        const resumed = await resumeSessionIdentity(targetSessionId.trim());
        if (resumed.data) {
          track(
            'session_joined',
            { deep_link: deep, auth: true, resumed: true },
            {
              userId: user?.id ?? null,
              sessionId: targetSessionId.trim(),
              participantId: resumed.data.participantId,
            }
          );
          navigate(`/session/${targetSessionId.trim()}`);
          return;
        }
        if (resumed.error) {
          setError(deep ? mapDeepLinkJoinError(resumed.error.message) : resumed.error.message);
          return;
        }
      }

      const result = await joinSession({
        sessionId: targetSessionId,
        nickname: callsign,
      });

      if (result.error) {
        setError(deep ? mapDeepLinkJoinError(result.error.message) : result.error.message);
        return;
      }

      if (result.data) {
        track(
          'session_joined',
          {
            deep_link: deep,
            auth: isAuthenticated,
            resumed: false,
            role: result.data.role,
          },
          {
            userId: user?.id ?? null,
            sessionId: targetSessionId.trim(),
            participantId: result.data.participantId,
          }
        );
        navigate(`/session/${targetSessionId.trim()}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(deep ? mapDeepLinkJoinError(message) : message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAutoJoinSession || isAuthLoading || !authCallsign) {
      return;
    }
    if (autoJoinedSessionIdRef.current === rallySessionId) {
      return;
    }
    autoJoinedSessionIdRef.current = rallySessionId;
    void performJoin(rallySessionId, authCallsign, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-join per rally session id
  }, [canAutoJoinSession, isAuthLoading, authCallsign, rallySessionId]);

  useEffect(() => {
    if (!canAutoJoinRallyPoint || isAuthLoading || !authCallsign) {
      return;
    }
    if (autoJoinedRallyPointIdRef.current === rallyPointId) {
      return;
    }
    autoJoinedRallyPointIdRef.current = rallyPointId;
    void performRallyPointJoin(rallyPointId, authCallsign);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-join per rallyPoint id
  }, [canAutoJoinRallyPoint, isAuthLoading, authCallsign, rallyPointId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    unlockTacticalAudio();
    if (rallyPointDeepLink) {
      if (!rallyPointUuidValid) {
        setError(SESSION_LOCKED_OR_INVALID);
        return;
      }
      await performRallyPointJoin(rallyPointId, nickname || authCallsign || '');
      return;
    }
    if (rallyDeepLink) {
      if (!rallyUuidValid) {
        setError(SESSION_LOCKED_OR_INVALID);
        return;
      }
      await performJoin(rallySessionId, nickname || authCallsign || '', true);
      return;
    }
    await performJoin(sessionId, nickname, false);
  }

  if ((rallyDeepLink && !rallyUuidValid) || (rallyPointDeepLink && !rallyPointUuidValid)) {
    return (
      <NarrowPageLayout title="Join session" subtitle="You’ve been invited">
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
      <NarrowPageLayout title="Join session" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Checking identity…</p>
      </NarrowPageLayout>
    );
  }

  if (deepLink && (canAutoJoinSession || canAutoJoinRallyPoint) && !error) {
    return (
      <NarrowPageLayout title="Join session" subtitle="You’ve been invited">
        <p className="text-sm text-secondary">Welcome, {authCallsign}. Joining…</p>
        {loading ? <p className="text-sm text-secondary">Joining…</p> : null}
      </NarrowPageLayout>
    );
  }

  if (deepLink) {
    return (
      <NarrowPageLayout title="Join session" subtitle="You’ve been invited">
        <p className="text-sm text-secondary lg:hidden">
          Enter a name to join. No account required.
        </p>
        <div className="hidden space-y-2 lg:block">
          <h1 className="text-display text-5xl text-ink">You’ve been invited</h1>
          <p className="text-sm text-secondary">Enter a name to join. No account required.</p>
        </div>

        <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wide">Your name</span>
            <input
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={authCallsign ?? 'Your name'}
              maxLength={50}
              required
              autoFocus
            />
          </label>

          {error ? <p className="text-error">{error}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full uppercase tracking-widest"
            disabled={loading}
          >
            {loading ? 'Joining…' : 'Join session'}
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
      <p className="text-sm text-secondary lg:hidden">Enter the session ID shared by your host.</p>

      <div className="hidden space-y-2 lg:block">
        <h1 className="text-display text-5xl text-ink">Join session</h1>
        <p className="text-sm text-secondary">Enter the session ID shared by your host.</p>
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
        <Link className="link-accent" to="/create">
          Create a new session
        </Link>
      </p>
    </NarrowPageLayout>
  );
}
