import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AuthModal } from '@/components/AuthModal';
import { IdentityOverlay } from '@/components/onboarding/IdentityOverlay';
import { GuidedIgnitionOverlay } from '@/components/onboarding/GuidedIgnitionOverlay';
import {
  hasCompletedGuidedIgnition,
  markGuidedIgnitionComplete,
} from '@/lib/onboarding/guidedIgnitionPrefs';
import { FeaturedWodCard } from '@/components/home/FeaturedWodCard';
import {
  CreateMissionSummaryPanel,
  type CreateScheduleMode,
} from '@/components/createMission/CreateMissionSummaryPanel';
import {
  WorkoutSourceToggle,
  type WorkoutSource,
} from '@/components/createMission/WorkoutSourceToggle';
import { WorkoutTemplatePicker } from '@/components/createMission/WorkoutTemplatePicker';
import { CoachWodPicker } from '@/components/createMission/CoachWodPicker';
import { exercisesToWorkoutText } from '@/lib/workout/templateToExercises';
import type { PublishedCoachWorkout } from '@/lib/api/coachWod';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import { createMission, fetchHostActiveMissionCount } from '@/lib/api/missions';
import { createRallyPointMission } from '@/lib/api/rallyPoint';
import { SendWorkoutToSquad } from '@/components/mission/SendWorkoutToSquad';
import { getSupabaseConfigError } from '@/lib/supabase';
import { track } from '@/lib/analytics/track';
import { quotasFromProfile } from '@/lib/hud/classificationQuotas';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEnsureAthleteIdentity } from '@/hooks/useEnsureAthleteIdentity';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';
import { useSmartRecovery } from '@/hooks/useSmartRecovery';
import { coachWorkoutLockId } from '@/lib/smartRecovery/deriveCoachWorkoutPatterns';
import { firstAvailableCategoryForDuration } from '@/lib/workout/filterWorkoutTemplates';
import { CUSTOM_WORKOUT_INTENSITY_TIER } from '@/lib/workout/resolveTemplateIntensity';
import { applyTemplate } from '@/lib/workout/templateToExercises';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import { isIntakeRequiredMessage } from '@/lib/auth/profileNeedsIntake';
import type { PasswordMode } from '@/components/AuthForm';
import {
  HOST_ACTIVE_MISSION_LIMIT,
  defaultRallyTime,
  isRallyTimeAllowed,
  rallyLocalDateTimeToIso,
  type RallyDay,
} from '@/lib/mission/rallySchedule';

// Copilot suggestion ignored: keep a local type to avoid coupling CreateMissionPage to IntakePage routing internals.
type IntakeNavigationState = {
  intakeNotices?: string[];
};

function isWorkoutCategory(value: string): value is WorkoutCategory {
  return WORKOUT_CATEGORIES.some((category) => category.id === value);
}

function isTimeDomain(value: number): value is TimeDomain {
  return (TIME_DOMAINS as number[]).includes(value);
}

export default function CreateMissionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { telemetry, isAuthenticated } = useHudTelemetry();
  const { profile, loading: profileLoading } = useAthleteProfile();
  const {
    ensureThen,
    open: identityOpen,
    overlayProps,
  } = useEnsureAthleteIdentity({
    acceptLabel: 'Accept & Launch',
  });
  const quotas = quotasFromProfile(profile);
  const [intakeNotices, setIntakeNotices] = useState<string[]>([]);
  const [workoutSource, setWorkoutSource] = useState<WorkoutSource>('library');
  const smartRecovery = useSmartRecovery({
    active: workoutSource === 'library' || workoutSource === 'coach',
  });
  const [nickname, setNickname] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('blood-shunt');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCoachWorkout, setSelectedCoachWorkout] = useState<PublishedCoachWorkout | null>(
    null
  );
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Push-ups');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<CreateScheduleMode>('now');
  const [rallyDay, setRallyDay] = useState<RallyDay>('today');
  const [rallyTime, setRallyTime] = useState(() =>
    defaultRallyTime(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
  );
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [authOpenMode, setAuthOpenMode] = useState<PasswordMode | null>(null);
  const submitAfterAuthRef = useRef(false);
  const guidedLaunchTemplateRef = useRef<WorkoutTemplate | null>(null);
  const [showGuidedIgnition, setShowGuidedIgnition] = useState(() => !hasCompletedGuidedIgnition());
  const [guestNameOpen, setGuestNameOpen] = useState(false);

  useEffect(() => {
    const state = location.state as IntakeNavigationState | null;
    if (!state?.intakeNotices?.length) {
      return;
    }
    setIntakeNotices(state.intakeNotices);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!profile?.nickname) {
      return;
    }
    setNickname((current) => (current.trim() === '' ? profile.nickname : current));
  }, [profile?.nickname]);

  useEffect(() => {
    let cancelled = false;
    fetchHostActiveMissionCount().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.data !== null) {
        setActiveCount(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const durationParam = searchParams.get('duration');
    if (!categoryParam && !durationParam) {
      return;
    }

    setWorkoutSource('library');

    const parsedDuration =
      durationParam !== null && Number.isInteger(Number(durationParam))
        ? Number(durationParam)
        : null;
    const duration =
      parsedDuration !== null && isTimeDomain(parsedDuration) ? parsedDuration : null;
    const category =
      categoryParam !== null && isWorkoutCategory(categoryParam) ? categoryParam : null;

    if (category !== null) {
      const meta = WORKOUT_CATEGORIES.find((entry) => entry.id === category);
      const resolvedDuration: TimeDomain | undefined =
        duration !== null && meta?.availableForDurations.includes(duration)
          ? duration
          : meta?.availableForDurations[0];
      if (resolvedDuration !== undefined) {
        setDurationMinutes(resolvedDuration);
        setSelectedTemplateId(null);
      }
      setSelectedCategory(category);
      return;
    }

    if (duration !== null) {
      setDurationMinutes(duration);
      setSelectedTemplateId(null);
      const nextCategory = firstAvailableCategoryForDuration(
        WORKOUT_CATEGORIES,
        duration,
        WORKOUT_TEMPLATES
      );
      if (nextCategory) {
        setSelectedCategory(nextCategory);
      }
    }
    // Deep-link filters apply once from the landing URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capReached = (activeCount ?? 0) >= HOST_ACTIVE_MISSION_LIMIT;

  const selectedTemplate = useMemo(
    () => WORKOUT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  );

  useEffect(() => {
    if (
      smartRecovery.enabled &&
      selectedTemplateId &&
      smartRecovery.locks.has(selectedTemplateId)
    ) {
      setSelectedTemplateId(null);
    }
  }, [smartRecovery.enabled, smartRecovery.locks, selectedTemplateId]);

  useEffect(() => {
    if (!smartRecovery.enabled || !selectedCoachWorkout) {
      return;
    }
    if (smartRecovery.locks.has(coachWorkoutLockId(selectedCoachWorkout.id))) {
      setSelectedCoachWorkout(null);
    }
  }, [smartRecovery.enabled, smartRecovery.locks, selectedCoachWorkout]);

  // What Start would send.
  const configuredWorkout = useMemo(() => {
    let movements: ReturnType<typeof parseWorkoutText> = [];
    try {
      movements = parseWorkoutText(workoutText);
    } catch {
      movements = [];
    }
    const intensityTier =
      workoutSource === 'library' && selectedTemplate
        ? selectedTemplate.intensityTier
        : workoutSource === 'coach' && selectedCoachWorkout
          ? selectedCoachWorkout.intensityTier
          : CUSTOM_WORKOUT_INTENSITY_TIER;
    const templateId =
      workoutSource === 'library' && selectedTemplateId
        ? selectedTemplateId
        : workoutSource === 'coach' && selectedCoachWorkout
          ? `coach:${selectedCoachWorkout.id}`
          : null;
    return { movements, intensityTier, templateId };
  }, [workoutText, workoutSource, selectedTemplate, selectedCoachWorkout, selectedTemplateId]);

  function handleDurationChange(duration: TimeDomain) {
    setDurationMinutes(duration);
    setSelectedTemplateId(null);

    const nextCategory = firstAvailableCategoryForDuration(
      WORKOUT_CATEGORIES,
      duration,
      WORKOUT_TEMPLATES
    );
    if (nextCategory) {
      setSelectedCategory(nextCategory);
    }
  }

  function handleSummaryDurationChange(duration: number) {
    handleDurationChange(duration as TimeDomain);
  }

  function handleTemplateSelect(template: WorkoutTemplate) {
    const applied = applyTemplate(template);
    setDurationMinutes(applied.durationMinutes);
    setWorkoutText(applied.workoutText);
    setSelectedTemplateId(template.id);
    if (template.category) {
      setSelectedCategory(template.category);
    }
    track('template_selected', {
      template_id: template.id,
      category: template.category ?? null,
      intensity_tier: template.intensityTier,
      duration_minutes: applied.durationMinutes,
    });
  }

  function handleWorkoutTextChange(value: string) {
    setWorkoutText(value);
    setSelectedTemplateId(null);
  }

  function handleWorkoutSourceChange(source: WorkoutSource) {
    setWorkoutSource(source);
    if (source === 'custom') {
      setSelectedTemplateId(null);
    }
    if (source !== 'coach') {
      setSelectedCoachWorkout(null);
    }
  }

  function handleCoachWorkoutSelect(workout: PublishedCoachWorkout) {
    setSelectedCoachWorkout(workout);
    setDurationMinutes(workout.durationMinutes);
    setWorkoutText(exercisesToWorkoutText(workout.movements));
    track('coach_workout_selected', {
      coach_workout_id: workout.id,
      duration_minutes: workout.durationMinutes,
      intensity_tier: workout.intensityTier,
    });
  }

  function beginLaunch(template?: WorkoutTemplate) {
    setError(null);

    const launchTemplate = template ?? guidedLaunchTemplateRef.current ?? undefined;

    if (workoutSource === 'library' && !selectedTemplate && !launchTemplate) {
      setError('Select a workout from the library before creating a mission.');
      return;
    }

    if (workoutSource === 'coach' && !selectedCoachWorkout) {
      setError('Select a coach workout before creating a mission.');
      return;
    }

    if (capReached) {
      setError('You already have 3 active missions.');
      return;
    }

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    if (!isAuthenticated) {
      if (scheduleMode === 'rally') {
        submitAfterAuthRef.current = true;
        setAuthOpenMode('sign-up');
        return;
      }

      const hostNick = nickname.trim();
      if (!hostNick) {
        if (launchTemplate) {
          guidedLaunchTemplateRef.current = launchTemplate;
        }
        setGuestNameOpen(true);
        return;
      }

      void igniteMission(true, {
        template: launchTemplate,
        nickname: hostNick,
      });
      return;
    }

    if (profileLoading) {
      submitAfterAuthRef.current = true;
      return;
    }

    ensureThen((accepted) => {
      void igniteMission(true, {
        template: launchTemplate ?? guidedLaunchTemplateRef.current ?? undefined,
        nickname: accepted?.nickname,
      });
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginLaunch();
  }

  async function igniteMission(
    retryAllowed = true,
    overrides?: { template?: WorkoutTemplate; nickname?: string }
  ) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let scheduledAt: string | undefined;
    if (scheduleMode === 'rally') {
      const iso = rallyLocalDateTimeToIso(rallyDay, rallyTime, timeZone, new Date());
      if (!iso || !isRallyTimeAllowed(iso, timeZone, new Date())) {
        setError('Rally time must be today or tomorrow, and in the future.');
        return;
      }
      scheduledAt = iso;
    }

    const launchTemplate = overrides?.template ?? guidedLaunchTemplateRef.current ?? undefined;
    const applied = launchTemplate ? applyTemplate(launchTemplate) : null;
    const hostNickname =
      (overrides?.nickname ?? nickname).trim() || profile?.nickname?.trim() || '';
    const missionDuration = applied?.durationMinutes ?? durationMinutes;
    const missionWorkoutText = applied?.workoutText ?? workoutText;

    if (!hostNickname) {
      if (!isAuthenticated && scheduleMode === 'now') {
        if (launchTemplate) {
          guidedLaunchTemplateRef.current = launchTemplate;
        }
        setGuestNameOpen(true);
        return;
      }
      setError('Enter your name or a nickname.');
      return;
    }

    setLoading(true);

    try {
      const workout = parseWorkoutText(missionWorkoutText);
      const intensityTier = launchTemplate
        ? launchTemplate.intensityTier
        : workoutSource === 'library' && selectedTemplate
          ? selectedTemplate.intensityTier
          : workoutSource === 'coach' && selectedCoachWorkout
            ? selectedCoachWorkout.intensityTier
            : CUSTOM_WORKOUT_INTENSITY_TIER;
      const templateId = launchTemplate
        ? launchTemplate.id
        : workoutSource === 'library' && selectedTemplateId
          ? selectedTemplateId
          : workoutSource === 'coach' && selectedCoachWorkout
            ? `coach:${selectedCoachWorkout.id}`
            : undefined;

      const createInput = {
        nickname: hostNickname,
        durationMinutes: missionDuration,
        workout,
        templateId,
        intensityTier,
        scheduledAt,
      };

      const result = !isAuthenticated
        ? await createMission({
            ...createInput,
            scheduledAt: undefined,
          })
        : await createRallyPointMission(createInput);

      if (result.error) {
        if (isAuthenticated && isIntakeRequiredMessage(result.error.message) && retryAllowed) {
          ensureThen((accepted) => {
            void igniteMission(false, {
              template: launchTemplate,
              nickname: accepted?.nickname ?? overrides?.nickname,
            });
          });
          return;
        }
        setError(result.error.message);
        return;
      }

      if (result.data) {
        guidedLaunchTemplateRef.current = null;
        navigate(`/mission/${result.data.missionId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!submitAfterAuthRef.current || !isAuthenticated || profileLoading) {
      return;
    }

    submitAfterAuthRef.current = false;
    setAuthOpenMode(null);

    const form = document.getElementById('create-mission-form');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, [isAuthenticated, profileLoading]);

  function handleAuthSuccess() {
    setAuthOpenMode(null);
    // submitAfterAuthRef stays true until profile finishes loading (effect above).
  }

  return (
    <main className="min-h-screen bg-page lg:flex lg:flex-col">
      <AppHeader title="Create mission" subtitle="Start a new AMRAP" />

      <div className="flex-1 px-6 pb-6 pt-0 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <p className="text-sm text-secondary lg:hidden">
            Start an AMRAP mission and invite friends to join.
          </p>

          <div className="hidden space-y-2 lg:block">
            <h1 className="text-display text-5xl text-ink">Create mission</h1>
            <p className="text-sm text-secondary">
              Start an AMRAP mission and invite friends to join.
            </p>
          </div>

          <FeaturedWodCard />

          {intakeNotices.length > 0 ? (
            <div className="card space-y-2 p-4" role="status">
              {intakeNotices.map((notice, index) => (
                <p key={index} className="text-sm text-secondary">
                  {notice}
                </p>
              ))}
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-accent"
                onClick={() => setIntakeNotices([])}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {profileLoading ? (
            <p className="text-sm text-secondary">Loading athlete profile…</p>
          ) : (
            <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
              <div
                className={[
                  'card space-y-6 p-6',
                  showGuidedIgnition ? 'pointer-events-none select-none blur-sm' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <WorkoutSourceToggle value={workoutSource} onChange={handleWorkoutSourceChange} />

                {workoutSource === 'custom' ? (
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Workout (one exercise per line)</span>
                    <textarea
                      className="input-field min-h-48"
                      value={workoutText}
                      onChange={(event) => handleWorkoutTextChange(event.target.value)}
                      placeholder="10 Burpees&#10;Row 200m&#10;Squats"
                      required
                    />
                  </label>
                ) : workoutSource === 'library' ? (
                  <WorkoutTemplatePicker
                    durationMinutes={durationMinutes as TimeDomain}
                    selectedCategory={selectedCategory}
                    selectedTemplateId={selectedTemplateId}
                    classification={telemetry?.classification ?? null}
                    perceivedClassification={profile?.perceivedClassification ?? null}
                    quotas={quotas}
                    smartRecoveryEnabled={smartRecovery.enabled}
                    onSmartRecoveryEnabledChange={smartRecovery.setEnabled}
                    recoveryLocks={smartRecovery.locks}
                    smartRecoveryActive={smartRecovery.enabled && isAuthenticated}
                    smartRecoveryLoading={smartRecovery.loading}
                    smartRecoveryError={smartRecovery.error}
                    isAuthenticated={isAuthenticated}
                    onDurationChange={handleDurationChange}
                    onCategoryChange={setSelectedCategory}
                    onTemplateSelect={handleTemplateSelect}
                  />
                ) : (
                  <CoachWodPicker
                    selectedWorkoutId={selectedCoachWorkout?.id ?? null}
                    smartRecoveryEnabled={smartRecovery.enabled}
                    onSmartRecoveryEnabledChange={smartRecovery.setEnabled}
                    recoveryLocks={smartRecovery.locks}
                    smartRecoveryActive={smartRecovery.enabled && isAuthenticated}
                    smartRecoveryLoading={smartRecovery.loading}
                    smartRecoveryError={smartRecovery.error}
                    isAuthenticated={isAuthenticated}
                    coachWorkouts={smartRecovery.enabled ? smartRecovery.coachWorkouts : undefined}
                    coachWorkoutsLoading={
                      smartRecovery.enabled &&
                      smartRecovery.loading &&
                      smartRecovery.coachWorkouts === null
                    }
                    onSelect={handleCoachWorkoutSelect}
                  />
                )}
              </div>

              <CreateMissionSummaryPanel
                nickname={nickname}
                durationMinutes={durationMinutes}
                workoutSource={workoutSource}
                selectedTemplate={selectedTemplate}
                selectedCoachWorkout={selectedCoachWorkout}
                scheduleMode={scheduleMode}
                rallyDay={rallyDay}
                rallyTime={rallyTime}
                capReached={capReached}
                error={error}
                unsignedHint={
                  isAuthenticated
                    ? null
                    : 'You can train now — save to your account after the mission.'
                }
                loading={loading}
                onNicknameChange={setNickname}
                onDurationChange={handleSummaryDurationChange}
                onScheduleModeChange={setScheduleMode}
                onRallyDayChange={setRallyDay}
                onRallyTimeChange={setRallyTime}
                onSubmit={handleSubmit}
              />

              <div className="pt-4">
                <SendWorkoutToSquad
                  durationMinutes={durationMinutes}
                  workout={configuredWorkout.movements}
                  templateId={configuredWorkout.templateId}
                  intensityTier={configuredWorkout.intensityTier}
                  ready={configuredWorkout.movements.length > 0}
                  triggerClassName="btn-outline w-full font-semibold"
                />
              </div>
            </div>
          )}

          <p className="text-center text-sm">
            <Link className="link-accent" to="/join">
              Join an existing mission
            </Link>
          </p>
        </div>
      </div>

      <footer className="hidden pb-6 text-center text-xs text-muted lg:block">
        AMRAP With Friends
      </footer>

      {authOpenMode ? (
        <AuthModal
          onClose={() => {
            submitAfterAuthRef.current = false;
            setAuthOpenMode(null);
          }}
          initialPasswordMode={authOpenMode}
          onAuthenticated={handleAuthSuccess}
          guestAllowed={false}
          heading="Save & Launch"
          subtitle="Create an account to hit the rally point and join the leaderboard."
        />
      ) : null}
      {showGuidedIgnition ? (
        <GuidedIgnitionOverlay
          onSelect={(id) => {
            const tpl = WORKOUT_TEMPLATES.find((t) => t.id === id);
            if (!tpl) {
              return;
            }
            handleTemplateSelect(tpl);
            guidedLaunchTemplateRef.current = tpl;
            markGuidedIgnitionComplete();
            setShowGuidedIgnition(false);
            beginLaunch(tpl);
          }}
          onSkip={() => {
            markGuidedIgnitionComplete();
            setShowGuidedIgnition(false);
          }}
        />
      ) : null}
      {guestNameOpen ? (
        <IdentityOverlay
          acceptLabel="Accept & Launch"
          dismissible
          onClose={() => setGuestNameOpen(false)}
          onAccept={async (input) => {
            setNickname(input.nickname);
            setGuestNameOpen(false);
            void igniteMission(true, {
              template: guidedLaunchTemplateRef.current ?? undefined,
              nickname: input.nickname,
            });
            return { error: null };
          }}
        />
      ) : null}
      {identityOpen ? <IdentityOverlay {...overlayProps} /> : null}
    </main>
  );
}
