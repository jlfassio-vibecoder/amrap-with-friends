import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { WorkoutTemplatePicker } from '@/components/createSession/WorkoutTemplatePicker';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useLobbyForceNav } from '@/hooks/useLobbyForceNav';
import { useStaleLobbyHostClaim } from '@/hooks/useStaleLobbyHostClaim';
import { useLobbyChannel } from '@/lib/realtime/useLobbyChannel';
import {
  closeLobby,
  joinLobby,
  leaveLobby,
  passLobbyCommand,
  startNextLobbySession,
  touchLobbyPresence,
} from '@/lib/api/lobby';
import {
  clearStoredLobbyIdentity,
  getStoredLobbyMemberId,
  getStoredLobbyNickname,
  persistLobbyIdentity,
} from '@/lib/lobbyIdentity';
import { canPassLobbyCommand } from '@/lib/lobby/canPassLobbyCommand';
import { setStoredHostToken } from '@/lib/sessionIdentity';
import { buildLobbyInviteUrl } from '@/lib/session/buildLobbyInviteUrl';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import { applyTemplate } from '@/lib/workout/templateToExercises';
import { firstAvailableCategoryForDuration } from '@/lib/workout/filterWorkoutTemplates';
import { callsignFromEmail } from '@/lib/sessionIdentity';
import { resumeSessionIdentity } from '@/lib/api/resumeSessionIdentity';
import {
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';

const HEARTBEAT_MS = 15_000;

export default function LobbyStagingPage() {
  const { lobbyId = '' } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();

  const [memberId, setMemberId] = useState(() => getStoredLobbyMemberId(lobbyId) ?? '');
  const [nickname, setNickname] = useState(
    () => getStoredLobbyNickname(lobbyId) ?? callsignFromEmail(user?.email) ?? 'Athlete'
  );
  const [durationMinutes, setDurationMinutes] = useState<TimeDomain>(10);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('blood-shunt');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Air Squats');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rejoinAttemptedRef = useRef(false);

  const selectedTemplate =
    WORKOUT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null;

  const presence = memberId ? { memberId, nickname } : null;
  const { lobby, presenceByMemberId, error, refresh } = useLobbyChannel(
    lobbyId || undefined,
    presence,
    { realtimeTables: isAuthenticated }
  );

  const forceNav = useLobbyForceNav({
    lobbyId,
    activeSessionId: lobby?.activeSessionId,
    activeSessionState: lobby?.activeSessionState,
    currentSessionId: null,
    enabled: Boolean(lobby && lobby.status === 'open'),
    onError: setActionError,
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

  // Deep link / new tab: rejoin so memberId exists for presence + force-nav.
  useEffect(() => {
    if (!lobbyId || isAuthLoading || rejoinAttemptedRef.current) {
      return;
    }
    if (getStoredLobbyMemberId(lobbyId)) {
      return;
    }
    const callsign = getStoredLobbyNickname(lobbyId) ?? callsignFromEmail(user?.email) ?? nickname;
    if (!callsign.trim()) {
      return;
    }
    // Guests need a prior nickname; authenticated users rejoin with callsign.
    if (!isAuthenticated && !getStoredLobbyNickname(lobbyId)) {
      return;
    }
    rejoinAttemptedRef.current = true;
    void (async () => {
      const result = await joinLobby({ lobbyId, nickname: callsign });
      if (result.error || !result.data) {
        setActionError(result.error?.message ?? 'Could not rejoin staging.');
        rejoinAttemptedRef.current = false;
        return;
      }
      setMemberId(result.data.lobbyMemberId);
      setNickname(result.data.nickname);
      await refresh();
    })();
  }, [lobbyId, isAuthenticated, isAuthLoading, user?.email, nickname, refresh]);

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

  const hostMemberId =
    lobby?.members.find((member) => Boolean(lobby.hostUserId) && member.userId === lobby.hostUserId)
      ?.id ?? null;

  useStaleLobbyHostClaim({
    lobbyId,
    hostUserId: lobby?.hostUserId,
    userId: user?.id,
    hostMemberId,
    presenceByMemberId,
    enabled: Boolean(lobby && lobby.status === 'open' && user?.id),
    onClaimed: (result) => {
      if (result.hostToken && result.activeSessionId) {
        setStoredHostToken(result.activeSessionId, result.hostToken);
      }
      void refresh();
    },
  });

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
  const displayError = actionError ?? error;

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
    if (!selectedTemplate) {
      setActionError('Select a workout from the library before starting the next session.');
      return;
    }
    setBusy(true);
    try {
      const workout = parseWorkoutText(workoutText);
      const result = await startNextLobbySession({
        lobbyId,
        durationMinutes,
        workout,
        templateId: selectedTemplate.id,
        intensityTier: selectedTemplate.intensityTier,
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

  function handleDurationChange(duration: TimeDomain) {
    setDurationMinutes(duration);
    const nextCategory = firstAvailableCategoryForDuration(
      WORKOUT_CATEGORIES,
      duration,
      WORKOUT_TEMPLATES
    );
    if (nextCategory) {
      setSelectedCategory(nextCategory);
    }
    setSelectedTemplateId(null);
  }

  function handleTemplateSelect(template: WorkoutTemplate) {
    const applied = applyTemplate(template);
    setDurationMinutes(applied.durationMinutes as TimeDomain);
    setWorkoutText(applied.workoutText);
    setSelectedTemplateId(template.id);
    if (template.category) {
      setSelectedCategory(template.category);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      // Was navigating home regardless: a guest's leave failed with
      // "Authentication required" and the seat stayed active, while the control
      // looked like it had worked.
      const result = await leaveLobby(lobbyId);
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      clearStoredLobbyIdentity(lobbyId);
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
        <p className="text-error mt-6">{displayError}</p>
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
        {forceNav.pendingSessionId ? (
          <div
            className="border-accent/40 flex flex-wrap items-center justify-between gap-3 border bg-surface px-4 py-3"
            role="status"
          >
            <p className="text-sm text-ink">
              Next session starting
              {forceNav.secondsLeft > 0 ? ` in ${forceNav.secondsLeft}s` : ''} —{' '}
              <button
                type="button"
                className="link-accent font-semibold"
                onClick={() => forceNav.joinNow()}
              >
                Join now
              </button>
            </p>
          </div>
        ) : null}
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
                const isMemberHost = Boolean(
                  lobby.hostUserId && member.userId === lobby.hostUserId
                );
                const canPass = isHost && canPassLobbyCommand(member, user?.id);
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
          {!isAuthenticated ? (
            <p className="text-xs text-muted">
              Save to your account to keep your spot between sessions.
            </p>
          ) : null}
        </section>

        {isHost ? (
          <section className="card space-y-4 p-5">
            <h2 className="text-display text-xl text-ink">Next session</h2>
            <form className="space-y-4" onSubmit={(e) => void handleStartNext(e)}>
              <WorkoutTemplatePicker
                durationMinutes={durationMinutes}
                selectedCategory={selectedCategory}
                selectedTemplateId={selectedTemplateId}
                onDurationChange={handleDurationChange}
                onCategoryChange={(category) => {
                  setSelectedCategory(category);
                  setSelectedTemplateId(null);
                }}
                onTemplateSelect={handleTemplateSelect}
              />
              {selectedTemplate ? (
                <p className="text-sm text-secondary">
                  Selected: <span className="text-ink">{selectedTemplate.name}</span>
                </p>
              ) : (
                <p className="text-sm text-secondary">
                  Select a workout to start the next session.
                </p>
              )}
              {displayError ? <p className="text-error text-sm">{displayError}</p> : null}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !selectedTemplate}
              >
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
            {displayError ? <p className="text-error text-sm">{displayError}</p> : null}
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
