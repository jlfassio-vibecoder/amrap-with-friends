import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { WorkoutTemplatePicker } from '@/components/createMission/WorkoutTemplatePicker';
import { SendWorkoutToSquad } from '@/components/mission/SendWorkoutToSquad';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useRallyPointForceNav } from '@/hooks/useRallyPointForceNav';
import { useStaleRallyPointHostClaim } from '@/hooks/useStaleRallyPointHostClaim';
import { useRallyPointChannel } from '@/lib/realtime/useRallyPointChannel';
import {
  closeRallyPoint,
  isCloseBlockedByLiveMission,
  joinRallyPoint,
  leaveRallyPoint,
  passRallyPointCommand,
  startNextRallyPointMission,
  touchRallyPointPresence,
} from '@/lib/api/rallyPoint';
import {
  clearStoredRallyPointIdentity,
  getStoredRallyPointMemberId,
  getStoredRallyPointNickname,
  persistRallyPointIdentity,
} from '@/lib/rallyPointIdentity';
import { canPassRallyPointCommand } from '@/lib/rallyPoint/canPassRallyPointCommand';
import { setStoredHostToken } from '@/lib/missionIdentity';
import { buildRallyPointInviteUrl } from '@/lib/mission/buildRallyPointInviteUrl';
import { ogCardFromSex } from '@/lib/share/ogCard';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import { applyTemplate } from '@/lib/workout/templateToExercises';
import { firstAvailableCategoryForDuration } from '@/lib/workout/filterWorkoutTemplates';
import { callsignFromEmail } from '@/lib/missionIdentity';
import { resumeMissionIdentity } from '@/lib/api/resumeMissionIdentity';
import {
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';

const HEARTBEAT_MS = 15_000;

export default function RallyPointPage() {
  const { rallyPointId = '' } = useParams<{ rallyPointId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthLoading } = useAmrapAuth();
  const { profile } = useAthleteProfile();

  const [memberId, setMemberId] = useState(() => getStoredRallyPointMemberId(rallyPointId) ?? '');
  const [nickname, setNickname] = useState(
    () => getStoredRallyPointNickname(rallyPointId) ?? callsignFromEmail(user?.email) ?? 'Athlete'
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

  // Same text the host would start, so what a friend receives cannot drift from
  // what "Start next mission" would run.
  const stagedWorkout = useMemo(() => {
    try {
      return parseWorkoutText(workoutText);
    } catch {
      return [];
    }
  }, [workoutText]);

  const presence = memberId ? { memberId, nickname } : null;
  const { rallyPoint, presenceByMemberId, error, refresh } = useRallyPointChannel(
    rallyPointId || undefined,
    presence,
    { realtimeTables: isAuthenticated }
  );

  const forceNav = useRallyPointForceNav({
    rallyPointId,
    activeMissionId: rallyPoint?.activeMissionId,
    activeMissionState: rallyPoint?.activeMissionState,
    currentMissionId: null,
    enabled: Boolean(rallyPoint && rallyPoint.status === 'open'),
    onError: setActionError,
  });

  useEffect(() => {
    if (!rallyPointId || !isAuthenticated) {
      return;
    }
    const storedMember = getStoredRallyPointMemberId(rallyPointId);
    const storedNick = getStoredRallyPointNickname(rallyPointId);
    if (storedMember) {
      setMemberId(storedMember);
    }
    if (storedNick) {
      setNickname(storedNick);
    }
  }, [rallyPointId, isAuthenticated]);

  // Deep link / new tab: rejoin so memberId exists for presence + force-nav.
  useEffect(() => {
    if (!rallyPointId || isAuthLoading || rejoinAttemptedRef.current) {
      return;
    }
    if (getStoredRallyPointMemberId(rallyPointId)) {
      return;
    }
    const callsign =
      getStoredRallyPointNickname(rallyPointId) ?? callsignFromEmail(user?.email) ?? nickname;
    if (!callsign.trim()) {
      return;
    }
    // Guests need a prior nickname; authenticated users rejoin with callsign.
    if (!isAuthenticated && !getStoredRallyPointNickname(rallyPointId)) {
      return;
    }
    rejoinAttemptedRef.current = true;
    void (async () => {
      const result = await joinRallyPoint({ rallyPointId, nickname: callsign });
      if (result.error || !result.data) {
        setActionError(result.error?.message ?? 'Could not rejoin the rally point.');
        rejoinAttemptedRef.current = false;
        return;
      }
      setMemberId(result.data.rallyPointMemberId);
      setNickname(result.data.nickname);
      await refresh();
    })();
  }, [rallyPointId, isAuthenticated, isAuthLoading, user?.email, nickname, refresh]);

  useEffect(() => {
    if (!rallyPointId || !memberId || !isAuthenticated) {
      return;
    }
    void touchRallyPointPresence(rallyPointId);
    const id = window.setInterval(() => {
      void touchRallyPointPresence(rallyPointId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [rallyPointId, memberId, isAuthenticated]);

  const hostMemberId =
    rallyPoint?.members.find(
      (member) => Boolean(rallyPoint.hostUserId) && member.userId === rallyPoint.hostUserId
    )?.id ?? null;

  useStaleRallyPointHostClaim({
    rallyPointId,
    hostUserId: rallyPoint?.hostUserId,
    userId: user?.id,
    hostMemberId,
    presenceByMemberId,
    enabled: Boolean(rallyPoint && rallyPoint.status === 'open' && user?.id),
    onClaimed: (result) => {
      if (result.hostToken && result.activeMissionId) {
        setStoredHostToken(result.activeMissionId, result.hostToken);
      }
      void refresh();
    },
  });

  useEffect(() => {
    if (
      !rallyPoint ||
      !user?.id ||
      rallyPoint.hostUserId !== user.id ||
      !rallyPoint.activeMissionId
    ) {
      return;
    }
    void resumeMissionIdentity(rallyPoint.activeMissionId).then((result) => {
      if (result.data?.hostToken) {
        setStoredHostToken(rallyPoint.activeMissionId!, result.data.hostToken);
      }
    });
  }, [rallyPoint, user?.id]);

  const isHost = Boolean(user?.id && rallyPoint && rallyPoint.hostUserId === user.id);
  const displayError = actionError ?? error;

  async function handlePassCommand(toUserId: string) {
    setActionError(null);
    setBusy(true);
    try {
      const result = await passRallyPointCommand({ rallyPointId, toUserId });
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      // Outgoing host token is cleared in passRallyPointCommand. New host picks up via
      // resumeMissionIdentity when host_user_id matches after refresh/realtime.
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleStartNext(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    if (!selectedTemplate) {
      setActionError('Select a workout from the library before starting the next mission.');
      return;
    }
    setBusy(true);
    try {
      const workout = parseWorkoutText(workoutText);
      const result = await startNextRallyPointMission({
        rallyPointId,
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
        persistRallyPointIdentity(rallyPointId, {
          memberId: memberId || getStoredRallyPointMemberId(rallyPointId) || '',
          nickname,
          missionId: result.data.missionId,
        });
        navigate(`/mission/${result.data.missionId}`, { replace: true });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start the next mission.');
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
      const result = await leaveRallyPoint(rallyPointId);
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      clearStoredRallyPointIdentity(rallyPointId);
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      const result = await closeRallyPoint(rallyPointId);
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
    const url = buildRallyPointInviteUrl(
      rallyPointId,
      window.location.origin,
      ogCardFromSex(profile?.biologicalSex)
    );
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Could not copy the rally link.');
    }
  }

  if (!rallyPointId) {
    return (
      <main className="min-h-screen bg-page p-6">
        <p className="text-error">Rally point not found.</p>
      </main>
    );
  }

  if (error && !rallyPoint) {
    return (
      <main className="min-h-screen bg-page p-6">
        <AppHeader title="Next Mission" />
        <p className="text-error mt-6">{displayError}</p>
        <Link className="link-accent mt-4 inline-block" to="/">
          Back home
        </Link>
      </main>
    );
  }

  const liveMissionBlocksClose = isCloseBlockedByLiveMission(rallyPoint?.activeMissionState);

  return (
    <main className="min-h-screen bg-page">
      <AppHeader title="Next Mission" subtitle="Pick the next workout with your squad" />
      <div className="mx-auto max-w-lg space-y-6 px-6 pb-10 pt-4">
        {forceNav.pendingMissionId ? (
          <div
            className="border-accent/40 flex flex-wrap items-center justify-between gap-3 border bg-surface px-4 py-3"
            role="status"
          >
            <p className="text-sm text-ink">
              Next mission starting
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
          {rallyPoint?.activeMissionId ? (
            <Link className="link-accent text-sm" to={`/mission/${rallyPoint.activeMissionId}`}>
              Open current mission
            </Link>
          ) : null}
        </div>

        <section className="card space-y-3 p-5">
          <h2 className="text-display text-xl text-ink">Your squad</h2>
          {!rallyPoint ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {rallyPoint.members.map((member) => {
                const online = Boolean(presenceByMemberId[member.id]);
                const isMemberHost = Boolean(
                  rallyPoint.hostUserId && member.userId === rallyPoint.hostUserId
                );
                const canPass = isHost && canPassRallyPointCommand(member, user?.id);
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
              Save to your account to keep your spot between missions.
            </p>
          ) : null}
        </section>

        {isHost ? (
          <section className="card space-y-4 p-5">
            <h2 className="text-display text-xl text-ink">Next mission</h2>
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
                  Select a workout to start the next mission.
                </p>
              )}
              {displayError ? <p className="text-error text-sm">{displayError}</p> : null}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !selectedTemplate}
              >
                {busy ? 'Starting…' : 'Start next mission'}
              </button>
            </form>
            {isAuthenticated ? (
              <SendWorkoutToSquad
                durationMinutes={durationMinutes}
                workout={stagedWorkout}
                templateId={selectedTemplate?.id}
                intensityTier={selectedTemplate?.intensityTier}
                ready={Boolean(selectedTemplate) && stagedWorkout.length > 0}
                triggerClassName="btn-outline w-full font-semibold"
                triggerLabel="Send this to a squad friend"
              />
            ) : null}
            <button
              type="button"
              className="text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || liveMissionBlocksClose}
              onClick={() => void handleClose()}
            >
              Close
            </button>
            {liveMissionBlocksClose ? (
              <p className="text-xs text-secondary">Finish the live mission before closing.</p>
            ) : null}
          </section>
        ) : (
          <section className="card space-y-2 p-5">
            <p className="text-sm text-secondary">Waiting for host to pick the next mission.</p>
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
            Leave rally point
          </button>
          <Link className="link-accent" to="/">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
