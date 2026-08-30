import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useLobbyForceNav } from '@/hooks/useLobbyForceNav';
import { useLobbyChannel } from '@/lib/realtime/useLobbyChannel';
import {
  claimLobbyCommandIfStale,
  closeLobby,
  leaveLobby,
  passLobbyCommand,
  startNextLobbySession,
  touchLobbyPresence,
} from '@/lib/api/lobby';
import {
  getStoredLobbyMemberId,
  getStoredLobbyNickname,
  persistLobbyIdentity,
} from '@/lib/lobbyIdentity';
import { setStoredHostToken } from '@/lib/sessionIdentity';
import { buildLobbyInviteUrl } from '@/lib/session/buildLobbyInviteUrl';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import { callsignFromEmail } from '@/lib/sessionIdentity';
import { resumeSessionIdentity } from '@/lib/api/resumeSessionIdentity';

const HEARTBEAT_MS = 15_000;
const STALE_CHECK_MS = 20_000;

export default function LobbyStagingPage() {
  const { lobbyId = '' } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAmrapAuth();

  const [memberId, setMemberId] = useState(() => getStoredLobbyMemberId(lobbyId) ?? '');
  const [nickname, setNickname] = useState(
    () => getStoredLobbyNickname(lobbyId) ?? callsignFromEmail(user?.email) ?? 'Athlete'
  );
  const [durationMinutes, setDurationMinutes] = useState(12);
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Air Squats');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const presence = memberId ? { memberId, nickname } : null;
  const { lobby, presenceByMemberId, error, refresh } = useLobbyChannel(
    lobbyId || undefined,
    presence
  );

  useLobbyForceNav({
    lobbyId,
    activeSessionId: lobby?.activeSessionId,
    currentSessionId: null,
    enabled: Boolean(lobby && lobby.status === 'open'),
  });

  useEffect(() => {
    if (!lobbyId || !isAuthenticated) {
      return;
    }
    const storedMember = getStoredLobbyMemberId(lobbyId);
    const storedNick = getStoredLobbyNickname(lobbyId);
    if (storedMember) {
      setMemberId(storedMember);
    }
    if (storedNick) {
      setNickname(storedNick);
    }
  }, [lobbyId, isAuthenticated]);

  useEffect(() => {
    if (!lobbyId || !memberId || !isAuthenticated) {
      return;
    }
    void touchLobbyPresence(lobbyId);
    const id = window.setInterval(() => {
      void touchLobbyPresence(lobbyId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [lobbyId, memberId, isAuthenticated]);

  useEffect(() => {
    if (!lobby || !user?.id || lobby.hostUserId === user.id) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        const result = await claimLobbyCommandIfStale(lobby.lobbyId);
        if (result.data?.claimed && result.data.hostToken && result.data.activeSessionId) {
          setStoredHostToken(result.data.activeSessionId, result.data.hostToken);
          await refresh();
        }
      })();
    }, STALE_CHECK_MS);
    return () => window.clearInterval(id);
  }, [lobby, user?.id, refresh]);

  // If the active session is still waiting, drop into it (first mission / resume).
  useEffect(() => {
    if (!lobby?.activeSessionId) {
      return;
    }
    // Force-nav hook handles navigation when session id is set; first paint into
    // waiting is the same path. Keep a soft link below for manual entry.
  }, [lobby?.activeSessionId]);

  useEffect(() => {
    if (!lobby || !user?.id || lobby.hostUserId !== user.id || !lobby.activeSessionId) {
      return;
    }
    void resumeSessionIdentity(lobby.activeSessionId).then((result) => {
      if (result.data?.hostToken) {
        setStoredHostToken(lobby.activeSessionId!, result.data.hostToken);
      }
    });
  }, [lobby, user?.id]);

  const isHost = Boolean(user?.id && lobby && lobby.hostUserId === user.id);

  async function handlePassCommand(toUserId: string) {
    setActionError(null);
    setBusy(true);
    try {
      const result = await passLobbyCommand({ lobbyId, toUserId });
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      // Outgoing host token is cleared in passLobbyCommand. New host picks up via
      // resumeSessionIdentity when host_user_id matches after refresh/realtime.
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleStartNext(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    setBusy(true);
    try {
      const workout = parseWorkoutText(workoutText);
      const result = await startNextLobbySession({
        lobbyId,
        durationMinutes,
        workout,
      });
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      if (result.data) {
        persistLobbyIdentity(lobbyId, {
          memberId: memberId || getStoredLobbyMemberId(lobbyId) || '',
          nickname,
          sessionId: result.data.sessionId,
        });
        navigate(`/session/${result.data.sessionId}`, { replace: true });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start the next session.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await leaveLobby(lobbyId);
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      const result = await closeLobby(lobbyId);
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyInvite() {
    const url = buildLobbyInviteUrl(lobbyId, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Could not copy the rally link.');
    }
  }

  if (!lobbyId) {
    return (
      <main className="min-h-screen bg-page p-6">
        <p className="text-error">Staging area not found.</p>
      </main>
    );
  }

  if (error && !lobby) {
    return (
      <main className="min-h-screen bg-page p-6">
        <AppHeader title="Staging area" />
        <p className="text-error mt-6">{error}</p>
        <Link className="link-accent mt-4 inline-block" to="/">
          Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="Staging area" subtitle="Next mission with the crew" />
      <div className="mx-auto max-w-lg space-y-6 px-6 pb-10 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={() => void handleCopyInvite()}>
            {copied ? 'LINK COPIED' : 'Copy rally link'}
          </button>
          {lobby?.activeSessionId ? (
            <Link className="link-accent text-sm" to={`/session/${lobby.activeSessionId}`}>
              Open current session
            </Link>
          ) : null}
        </div>

        <section className="card space-y-3 p-5">
          <h2 className="text-display text-xl text-ink">The crew</h2>
          {!lobby ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {lobby.members.map((member) => {
                const online = Boolean(presenceByMemberId[member.id]);
                const isMemberHost = member.userId === lobby.hostUserId;
                const canPass =
                  isHost &&
                  Boolean(member.userId) &&
                  member.userId !== user?.id &&
                  member.status === 'active';
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-divider py-2 last:border-0"
                  >
                    <div>
                      <span className="text-ink">{member.nickname}</span>
                      {isMemberHost ? (
                        <span className="ml-2 text-xs uppercase tracking-widest text-accent">
                          Host
                        </span>
                      ) : null}
                      <span
                        className={`ml-2 text-xs uppercase tracking-widest ${
                          online ? 'text-accent' : 'text-muted'
                        }`}
                      >
                        {online ? 'Here' : 'Away'}
                      </span>
                    </div>
                    {canPass ? (
                      <button
                        type="button"
                        className="text-xs uppercase tracking-widest text-muted hover:text-ink"
                        disabled={busy || !member.userId}
                        onClick={() => member.userId && void handlePassCommand(member.userId)}
                      >
                        Pass Command
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">
            Save to your account to keep your spot between sessions.
          </p>
        </section>

        {isHost ? (
          <section className="card space-y-4 p-5">
            <h2 className="text-display text-xl text-ink">Next session</h2>
            <form className="space-y-4" onSubmit={(e) => void handleStartNext(e)}>
              <label className="block space-y-1 text-sm">
                <span className="text-secondary">Duration (minutes)</span>
                <input
                  className="input-field w-full"
                  type="number"
                  min={1}
                  max={60}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 12)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-secondary">Workout (one movement per line)</span>
                <textarea
                  className="input-field min-h-28 w-full"
                  value={workoutText}
                  onChange={(e) => setWorkoutText(e.target.value)}
                />
              </label>
              {actionError ? <p className="text-error text-sm">{actionError}</p> : null}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Starting…' : 'Start next session'}
              </button>
            </form>
            <button
              type="button"
              className="text-sm text-muted hover:text-ink"
              disabled={busy}
              onClick={() => void handleClose()}
            >
              Close staging area
            </button>
          </section>
        ) : (
          <section className="card space-y-2 p-5">
            <p className="text-sm text-secondary">Waiting for host to pick the next session.</p>
            {actionError ? <p className="text-error text-sm">{actionError}</p> : null}
          </section>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <button
            type="button"
            className="link-accent"
            disabled={busy}
            onClick={() => void handleLeave()}
          >
            Leave staging
          </button>
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
