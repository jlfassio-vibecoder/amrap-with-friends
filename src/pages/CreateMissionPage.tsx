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
import { MissionChainBuilder } from '@/components/createMission/MissionChainBuilder';
import {
  WorkoutSourceToggle,
  type WorkoutSource,
} from '@/components/createMission/WorkoutSourceToggle';
import { WorkoutTemplatePicker } from '@/components/createMission/WorkoutTemplatePicker';
import { AmqapFlowPicker } from '@/components/createMission/AmqapFlowPicker';
import { RetestBanner } from '@/components/createMission/RetestBanner';
import { CoachWodPicker } from '@/components/createMission/CoachWodPicker';
import {
  applyTemplate,
  exercisesToWorkoutText,
  templateToExercises,
} from '@/lib/workout/templateToExercises';
import type { PublishedCoachWorkout } from '@/lib/api/coachWod';
import {
  AMQAP_FLOWS,
  isAmqapTimeDomain,
  type AmqapFlowId,
  type AmqapTimeDomain,
} from '@/data/amqapFlows';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import { defaultCapForDomain, domainForCap, type MissionTimeCap } from '@/lib/timeDomains';
import { createMission, fetchHostActiveMissionCount } from '@/lib/api/missions';
import { fetchMyBenchmarks, type AthleteBenchmark } from '@/lib/api/benchmarks';
import { writeScalingPlan } from '@/lib/mission/scalingPlan';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import { createRallyPointMission } from '@/lib/api/rallyPoint';
import { setMissionChain as persistMissionChain } from '@/lib/api/missionChain';
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
import {
  appendTemplatesToChainDraft,
  reconcileChainDraft,
  templatesInSelectionOrder,
  type ChainDraftItem,
} from '@/lib/mission/chainDraft';
import { MAX_CHAIN_LENGTH } from '@/lib/mission/chainRest';

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

function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const to = index + offset;
  if (to < 0 || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
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
  /** The mission clock — may differ from the domain once the host adjusts the cap. */
  const [durationMinutes, setDurationMinutes] = useState<MissionTimeCap>(5);
  /** The library bucket the picker filters by — never the clock. */
  const [selectedDomain, setSelectedDomain] = useState<TimeDomain>(5);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('blood-shunt');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedAmqapFlowId, setSelectedAmqapFlowId] = useState<AmqapFlowId>('foundational');
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
  const [missionChain, setMissionChainDraft] = useState<ChainDraftItem[]>([]);
  /** Set from ?benchmark=<id>: the workout and clock are fixed while retesting. */
  const [retest, setRetest] = useState<AthleteBenchmark | null>(null);

  useEffect(() => {
    track('create_viewed');
  }, []);

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
    const templateParam = searchParams.get('template');
    // Template deep-link owns the initial selection when present.
    if (templateParam) {
      return;
    }

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
        setSelectedDomain(resolvedDuration);
        setDurationMinutes(defaultCapForDomain(resolvedDuration));
        setSelectedTemplateIds([]);
      }
      setSelectedCategory(category);
      return;
    }

    if (duration !== null) {
      setDurationMinutes(duration);
      setSelectedTemplateIds([]);
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

  const focusTemplateId = selectedTemplateIds[0] ?? null;
  const selectedTemplate = useMemo(
    () =>
      WORKOUT_TEMPLATES.find((template) => template.id === focusTemplateId) ??
      AMQAP_FLOWS.find((template) => template.id === focusTemplateId) ??
      null,
    [focusTemplateId]
  );

  useEffect(() => {
    if (!smartRecovery.enabled) {
      return;
    }

    const nextIds = selectedTemplateIds.filter((id) => !smartRecovery.locks.has(id));
    if (nextIds.length !== selectedTemplateIds.length) {
      const firstId = nextIds[0];
      const first = firstId
        ? (WORKOUT_TEMPLATES.find((entry) => entry.id === firstId) ?? null)
        : null;
      if (first) {
        applyLibraryTemplate(first);
      }
      setSelectedTemplateIds(nextIds);
      return;
    }

    setMissionChainDraft((currentChain) => {
      const nextChain = reconcileChainDraft(
        currentChain.filter((item) => !smartRecovery.locks.has(item.templateId)),
        templatesInSelectionOrder(nextIds, WORKOUT_TEMPLATES),
        durationMinutes,
        selectedDomain
      );
      if (
        nextChain.length === currentChain.length &&
        nextChain.every(
          (item, index) =>
            item.id === currentChain[index]?.id &&
            item.templateId === currentChain[index]?.templateId
        )
      ) {
        return currentChain;
      }
      return nextChain;
    });
  }, [
    smartRecovery.enabled,
    smartRecovery.locks,
    selectedTemplateIds,
    durationMinutes,
    selectedDomain,
  ]);

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
    const usesSelectedTemplate = workoutSource === 'library' || workoutSource === 'amqap';
    const intensityTier =
      usesSelectedTemplate && selectedTemplate
        ? selectedTemplate.intensityTier
        : workoutSource === 'coach' && selectedCoachWorkout
          ? selectedCoachWorkout.intensityTier
          : CUSTOM_WORKOUT_INTENSITY_TIER;
    const templateId =
      usesSelectedTemplate && selectedTemplate
        ? selectedTemplate.id
        : workoutSource === 'coach' && selectedCoachWorkout
          ? `coach:${selectedCoachWorkout.id}`
          : null;
    return { movements, intensityTier, templateId };
  }, [workoutText, workoutSource, selectedTemplate, selectedCoachWorkout]);

  function handleDurationChange(domain: TimeDomain) {
    if (domain === selectedDomain) {
      return;
    }
    setSelectedDomain(domain);
    setDurationMinutes(defaultCapForDomain(domain));
    setSelectedTemplateIds([]);
    setMissionChainDraft([]);

    const nextCategory = firstAvailableCategoryForDuration(
      WORKOUT_CATEGORIES,
      domain,
      WORKOUT_TEMPLATES
    );
    if (nextCategory) {
      setSelectedCategory(nextCategory);
    }
  }

  const benchmarkParam = searchParams.get('benchmark');
  useEffect(() => {
    if (!benchmarkParam || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      void fetchMyBenchmarks().then((result) => {
        if (cancelled || result.error || !result.data) {
          return;
        }
        const match = result.data.find((entry) => entry.id === benchmarkParam);
        // A benchmark id that is not the caller's own simply does not resolve;
        // the page stays an ordinary Create rather than erroring at someone who
        // followed a stale link.
        if (!match) {
          return;
        }
        const template = WORKOUT_TEMPLATES.find((entry) => entry.id === match.templateId);
        if (!template) {
          return;
        }
        setWorkoutSource('library');
        setRetest(match);
        setSelectedTemplateIds([template.id]);
        setSelectedDomain(domainForCap(match.durationMinutes) ?? match.timeDomain);
        // The benchmark's stored clock, not the template's default: the athlete
        // may have benchmarked at 12 minutes in the 15-minute domain, and a
        // retest at 15 would not be a retest.
        setDurationMinutes(match.durationMinutes);
        setWorkoutText(applyTemplate(template).workoutText);
        if (template.category) {
          setSelectedCategory(template.category);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [benchmarkParam, isAuthenticated]);

  function handleSummaryDurationChange(duration: number) {
    // The summary control still offers the four canonical minutes, so anything
    // it emits is a domain. The guard replaces a cast that would have lied the
    // moment that control starts offering in-range caps.
    if (isTimeDomain(duration)) {
      handleDurationChange(duration);
    }
  }

  function applyLibraryTemplate(template: WorkoutTemplate) {
    const applied = applyTemplate(template);
    setDurationMinutes(applied.durationMinutes);
    setSelectedDomain(domainForCap(applied.durationMinutes) ?? selectedDomain);
    setWorkoutText(applied.workoutText);
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

  function commitLibrarySelection(nextIds: string[], clock: MissionTimeCap, domain: TimeDomain) {
    setSelectedTemplateIds(nextIds);
    if (!isAuthenticated) {
      setMissionChainDraft([]);
      return;
    }
    setMissionChainDraft((current) =>
      reconcileChainDraft(
        current,
        templatesInSelectionOrder(nextIds, WORKOUT_TEMPLATES),
        clock,
        domain
      )
    );
  }

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) {
      return;
    }
    const template = WORKOUT_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }

    setWorkoutSource('library');
    applyLibraryTemplate(template);
    const applied = applyTemplate(template);
    const domain = domainForCap(applied.durationMinutes) ?? selectedDomain;
    commitLibrarySelection([template.id], applied.durationMinutes, domain);
    // Deep-link template applies once from the landing URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTemplateSelect(template: WorkoutTemplate) {
    const alreadySelected = selectedTemplateIds.includes(template.id);
    if (alreadySelected) {
      const remaining = selectedTemplateIds.filter((id) => id !== template.id);
      const firstId = remaining[0];
      const first = firstId
        ? (WORKOUT_TEMPLATES.find((entry) => entry.id === firstId) ?? null)
        : null;
      if (first) {
        applyLibraryTemplate(first);
      }
      const applied = first ? applyTemplate(first) : null;
      commitLibrarySelection(
        remaining,
        applied?.durationMinutes ?? durationMinutes,
        applied ? (domainForCap(applied.durationMinutes) ?? selectedDomain) : selectedDomain
      );
      return;
    }

    // Guests launch one workout; keep the pressed card exclusive so Launch
    // matches the visible selection.
    if (!isAuthenticated) {
      applyLibraryTemplate(template);
      const applied = applyTemplate(template);
      commitLibrarySelection(
        [template.id],
        applied.durationMinutes,
        domainForCap(applied.durationMinutes) ?? selectedDomain
      );
      return;
    }

    if (selectedTemplateIds.length >= MAX_CHAIN_LENGTH) {
      return;
    }

    const isFirst = selectedTemplateIds.length === 0;
    if (isFirst) {
      applyLibraryTemplate(template);
    }
    const applied = applyTemplate(template);
    const clock = isFirst ? applied.durationMinutes : durationMinutes;
    const domain = isFirst
      ? (domainForCap(applied.durationMinutes) ?? selectedDomain)
      : selectedDomain;
    commitLibrarySelection([...selectedTemplateIds, template.id], clock, domain);
  }

  function handleWorkoutTextChange(value: string) {
    setWorkoutText(value);
    setSelectedTemplateIds([]);
    setMissionChainDraft([]);
  }

  function handleAmqapDurationChange(duration: AmqapTimeDomain) {
    setSelectedDomain(duration);
    setDurationMinutes(duration);
    setSelectedTemplateIds([]);
  }

  function handleAmqapTemplateSelect(template: WorkoutTemplate) {
    if (selectedTemplateIds.includes(template.id)) {
      setSelectedTemplateIds([]);
      return;
    }
    applyLibraryTemplate(template);
    setSelectedTemplateIds([template.id]);
  }

  function handleWorkoutSourceChange(source: WorkoutSource) {
    setError(null);
    if (source !== 'library') {
      setMissionChainDraft([]);
    }
    if (source !== workoutSource) {
      setSelectedTemplateIds([]);
    }
    if (source !== 'coach') {
      setSelectedCoachWorkout(null);
    }
    setWorkoutSource(source);
    if (source === 'amqap' && !isAmqapTimeDomain(durationMinutes)) {
      setSelectedDomain(10);
      setDurationMinutes(10);
    } else if (source === 'amqap' && isAmqapTimeDomain(durationMinutes)) {
      setSelectedDomain(durationMinutes);
    }
  }

  function handleChainMoveUp(index: number) {
    if (index <= 0) {
      return;
    }
    setMissionChainDraft((current) => moveItem(current, index, -1));
    setSelectedTemplateIds((current) => moveItem(current, index, -1));
    if (index === 1) {
      const nextFirst = missionChain[index];
      const template = nextFirst
        ? WORKOUT_TEMPLATES.find((entry) => entry.id === nextFirst.templateId)
        : undefined;
      if (template) {
        applyLibraryTemplate(template);
      }
    }
  }

  function handleChainMoveDown(index: number) {
    if (index >= missionChain.length - 1) {
      return;
    }
    setMissionChainDraft((current) => moveItem(current, index, 1));
    setSelectedTemplateIds((current) => moveItem(current, index, 1));
    if (index === 0) {
      const nextFirst = missionChain[1];
      const template = nextFirst
        ? WORKOUT_TEMPLATES.find((entry) => entry.id === nextFirst.templateId)
        : undefined;
      if (template) {
        applyLibraryTemplate(template);
      }
    }
  }

  function handleChainRemove(index: number) {
    const remainingIds = selectedTemplateIds.filter((_, i) => i !== index);
    const nextFirstId = remainingIds[0];
    const template = nextFirstId
      ? WORKOUT_TEMPLATES.find((entry) => entry.id === nextFirstId)
      : undefined;
    if (template) {
      applyLibraryTemplate(template);
    }
    const applied = template ? applyTemplate(template) : null;
    commitLibrarySelection(
      remainingIds,
      applied?.durationMinutes ?? durationMinutes,
      applied ? (domainForCap(applied.durationMinutes) ?? selectedDomain) : selectedDomain
    );
  }

  function handleChainCapChange(index: number, cap: MissionTimeCap) {
    setMissionChainDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, durationMinutes: cap } : item))
    );
    if (index === 0) {
      setDurationMinutes(cap);
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
    const shouldAutoAdd =
      isAuthenticated &&
      workoutSource === 'library' &&
      missionChain.length === 0 &&
      selectedTemplateIds.length >= 2;
    const chainForLaunch = shouldAutoAdd
      ? appendTemplatesToChainDraft(
          [],
          templatesInSelectionOrder(selectedTemplateIds, WORKOUT_TEMPLATES),
          durationMinutes,
          selectedDomain
        )
      : missionChain;
    const launchingFromChain = chainForLaunch.length >= 2;

    if (
      workoutSource === 'library' &&
      !launchingFromChain &&
      selectedTemplateIds.length === 0 &&
      !selectedTemplate &&
      !launchTemplate
    ) {
      setError('Select a workout from the library before planning a mission.');
      return;
    }

    if (
      workoutSource === 'amqap' &&
      selectedTemplateIds.length === 0 &&
      !selectedTemplate &&
      !launchTemplate
    ) {
      setError('Select a quality flow before planning a mission.');
      return;
    }

    if (workoutSource === 'coach' && !selectedCoachWorkout) {
      setError('Select a coach workout before planning a mission.');
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

    function commitAutoAddAndIgnite(overrides: { template?: WorkoutTemplate; nickname?: string }) {
      if (shouldAutoAdd) {
        setMissionChainDraft(chainForLaunch);
      }
      void igniteMission(true, { ...overrides, chain: chainForLaunch });
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

      commitAutoAddAndIgnite({
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
      commitAutoAddAndIgnite({
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
    overrides?: { template?: WorkoutTemplate; nickname?: string; chain?: ChainDraftItem[] }
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
      const chain = overrides?.chain ?? missionChain;
      const useChain = isAuthenticated && chain.length >= 2;
      const firstChainItem = useChain ? chain[0] : null;

      const workout = firstChainItem
        ? firstChainItem.workout
        : (workoutSource === 'library' || workoutSource === 'amqap') && selectedTemplate
          ? templateToExercises(selectedTemplate)
          : launchTemplate
            ? templateToExercises(launchTemplate)
            : parseWorkoutText(missionWorkoutText);
      const intensityTier = firstChainItem
        ? firstChainItem.intensityTier
        : launchTemplate
          ? launchTemplate.intensityTier
          : (workoutSource === 'library' || workoutSource === 'amqap') && selectedTemplate
            ? selectedTemplate.intensityTier
            : workoutSource === 'coach' && selectedCoachWorkout
              ? selectedCoachWorkout.intensityTier
              : CUSTOM_WORKOUT_INTENSITY_TIER;
      const templateId = firstChainItem
        ? firstChainItem.templateId
        : launchTemplate
          ? launchTemplate.id
          : (workoutSource === 'library' || workoutSource === 'amqap') && selectedTemplate
            ? selectedTemplate.id
            : workoutSource === 'coach' && selectedCoachWorkout
              ? `coach:${selectedCoachWorkout.id}`
              : undefined;
      const resolvedDuration = firstChainItem
        ? firstChainItem.durationMinutes
        : (applied?.durationMinutes ?? durationMinutes);

      const createInput = {
        nickname: hostNickname,
        durationMinutes: resolvedDuration,
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
              chain,
            });
          });
          return;
        }
        setError(result.error.message);
        return;
      }

      if (result.data) {
        const created = result.data;
        let chainSaveError: string | null = null;
        const rallyPointId =
          'rallyPointId' in created && typeof created.rallyPointId === 'string'
            ? created.rallyPointId
            : null;
        if (isAuthenticated && chain.length >= 2 && rallyPointId) {
          const chainResult = await persistMissionChain({
            rallyPointId,
            items: chain.map((item, index) => ({
              durationMinutes: item.durationMinutes,
              workout: item.workout,
              templateId: item.templateId,
              intensityTier: item.intensityTier,
              startedMissionId: index === 0 ? created.missionId : null,
            })),
          });
          if (chainResult.error) {
            // The mission and its hub already exist and are perfectly usable —
            // they are just not chained. Stranding the host here would leave a
            // live mission counting against their active limit that they cannot
            // reach, and cannot repair either, because set_mission_chain refuses
            // to rewrite a chain whose first item has already started. Carry the
            // failure to the mission instead of swallowing it.
            chainSaveError = chainResult.error.message;
          }
        }

        if (retest && Object.keys(retest.movementVariants).length > 0) {
          // Carry the benchmark's modification onto the new mission, so the
          // athlete retests the way they measured rather than defaulting to
          // "as programmed" — and so the rally point offers the same-variant
          // ghost without them having to reconstruct anything.
          writeScalingPlan(created.missionId, created.participantId, retest.movementVariants);
        }

        guidedLaunchTemplateRef.current = null;
        const missionPath = `/mission/${created.missionId}`;
        if (chainSaveError) {
          navigate(missionPath, { state: { chainSaveError } });
        } else {
          navigate(missionPath);
        }
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
      <AppHeader title="Plan mission" subtitle="Start a new AMRAP" />

      <div className="flex-1 px-6 pb-6 pt-0 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <p className="text-sm text-secondary lg:hidden">
            Start an AMRAP mission and invite friends to join.
          </p>

          <div className="hidden space-y-2 lg:block">
            <h1 className="text-display text-5xl text-ink">Plan mission</h1>
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
                {retest ? (
                  <RetestBanner
                    workoutTitle={resolveWorkoutTitle(retest.templateId)}
                    durationMinutes={retest.durationMinutes}
                    movementVariants={retest.movementVariants}
                    onCancel={() => setRetest(null)}
                  />
                ) : (
                  <WorkoutSourceToggle value={workoutSource} onChange={handleWorkoutSourceChange} />
                )}

                {retest ? null : workoutSource === 'custom' ? (
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
                    durationMinutes={selectedDomain}
                    selectedCategory={selectedCategory}
                    selectedTemplateIds={selectedTemplateIds}
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
                ) : workoutSource === 'amqap' ? (
                  <AmqapFlowPicker
                    durationMinutes={isAmqapTimeDomain(selectedDomain) ? selectedDomain : 10}
                    selectedFlowId={selectedAmqapFlowId}
                    selectedTemplateIds={selectedTemplateIds}
                    onDurationChange={handleAmqapDurationChange}
                    onFlowChange={setSelectedAmqapFlowId}
                    onTemplateSelect={handleAmqapTemplateSelect}
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
                selectedDomain={selectedDomain}
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
                chainBuilder={
                  workoutSource === 'library' ? (
                    <MissionChainBuilder
                      items={missionChain}
                      isAuthenticated={isAuthenticated}
                      onMoveUp={handleChainMoveUp}
                      onMoveDown={handleChainMoveDown}
                      onRemove={handleChainRemove}
                      onCapChange={handleChainCapChange}
                    />
                  ) : null
                }
                hidePageTimeCap={missionChain.length >= 2}
                chainedWorkoutCount={missionChain.length}
                loading={loading}
                onNicknameChange={setNickname}
                durationLockedNote={
                  retest
                    ? 'set by your benchmark'
                    : workoutSource === 'amqap'
                      ? 'set by this quality flow'
                      : null
                }
                onDurationChange={handleSummaryDurationChange}
                onCapChange={(cap) => {
                  setDurationMinutes(cap);
                  setMissionChainDraft((current) =>
                    current.length === 1 ? [{ ...current[0]!, durationMinutes: cap }] : current
                  );
                }}
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
