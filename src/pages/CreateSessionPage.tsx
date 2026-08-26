import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import {
  CreateSessionSummaryPanel,
  type CreateScheduleMode,
} from '@/components/createSession/CreateSessionSummaryPanel';
import {
  WorkoutSourceToggle,
  type WorkoutSource,
} from '@/components/createSession/WorkoutSourceToggle';
import { WorkoutTemplatePicker } from '@/components/createSession/WorkoutTemplatePicker';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import { createSession, fetchHostActiveSessionCount } from '@/lib/api/sessions';
import { getSupabaseConfigError } from '@/lib/supabase';
import { track } from '@/lib/analytics/track';
import { quotasFromProfile } from '@/lib/hud/classificationQuotas';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useHudTelemetry } from '@/hooks/useHudTelemetry';
import { firstAvailableCategoryForDuration } from '@/lib/workout/filterWorkoutTemplates';
import { CUSTOM_WORKOUT_INTENSITY_TIER } from '@/lib/workout/resolveTemplateIntensity';
import { applyTemplate } from '@/lib/workout/templateToExercises';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';
import {
  HOST_ACTIVE_SESSION_LIMIT,
  defaultRallyTime,
  isRallyTimeAllowed,
  rallyLocalDateTimeToIso,
  type RallyDay,
} from '@/lib/session/rallySchedule';

function isWorkoutCategory(value: string): value is WorkoutCategory {
  return WORKOUT_CATEGORIES.some((category) => category.id === value);
}

function isTimeDomain(value: number): value is TimeDomain {
  return (TIME_DOMAINS as number[]).includes(value);
}

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { telemetry } = useHudTelemetry();
  const { profile, loading: profileLoading } = useAthleteProfile();
  const quotas = quotasFromProfile(profile);
  const [workoutSource, setWorkoutSource] = useState<WorkoutSource>('library');
  const [nickname, setNickname] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('blood-shunt');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Push-ups');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<CreateScheduleMode>('now');
  const [rallyDay, setRallyDay] = useState<RallyDay>('today');
  const [rallyTime, setRallyTime] = useState(() =>
    defaultRallyTime(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone
    )
  );
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.nickname) {
      return;
    }
    setNickname((current) => (current.trim() === '' ? profile.nickname : current));
  }, [profile?.nickname]);

  useEffect(() => {
    let cancelled = false;
    fetchHostActiveSessionCount().then((result) => {
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

  const capReached = (activeCount ?? 0) >= HOST_ACTIVE_SESSION_LIMIT;

  const selectedTemplate = useMemo(
    () => WORKOUT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  );

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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (workoutSource === 'library' && !selectedTemplate) {
      setError('Select a workout from the library before creating a session.');
      return;
    }

    if (capReached) {
      setError('You already have 3 active sessions.');
      return;
    }

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return;
    }

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

    setLoading(true);

    try {
      const workout = parseWorkoutText(workoutText);
      const intensityTier =
        workoutSource === 'library' && selectedTemplate
          ? selectedTemplate.intensityTier
          : CUSTOM_WORKOUT_INTENSITY_TIER;
      const result = await createSession({
        nickname,
        durationMinutes,
        workout,
        templateId:
          workoutSource === 'library' && selectedTemplateId
            ? selectedTemplateId
            : undefined,
        intensityTier,
        scheduledAt,
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
    <main className="min-h-screen bg-page lg:flex lg:flex-col">
      <AppHeader title="Create session" subtitle="Start a new AMRAP" />

      <div className="flex-1 px-6 pb-6 pt-0 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <p className="text-sm text-secondary lg:hidden">
            Start an AMRAP session and invite friends to join.
          </p>

          <div className="hidden space-y-2 lg:block">
            <h1 className="text-display text-5xl text-ink">Create session</h1>
            <p className="text-sm text-secondary">
              Start an AMRAP session and invite friends to join.
            </p>
          </div>

          {profileLoading ? (
            <p className="text-sm text-secondary">Loading athlete profile…</p>
          ) : (
          <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
            <div className="card space-y-6 p-6">
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
              ) : (
                <WorkoutTemplatePicker
                  durationMinutes={durationMinutes as TimeDomain}
                  selectedCategory={selectedCategory}
                  selectedTemplateId={selectedTemplateId}
                  classification={telemetry?.classification ?? null}
                  perceivedClassification={profile?.perceivedClassification ?? null}
                  quotas={quotas}
                  onDurationChange={handleDurationChange}
                  onCategoryChange={setSelectedCategory}
                  onTemplateSelect={handleTemplateSelect}
                />
              )}
            </div>

            <CreateSessionSummaryPanel
              nickname={nickname}
              durationMinutes={durationMinutes}
              workoutSource={workoutSource}
              selectedTemplate={selectedTemplate}
              scheduleMode={scheduleMode}
              rallyDay={rallyDay}
              rallyTime={rallyTime}
              capReached={capReached}
              error={error}
              loading={loading}
              onNicknameChange={setNickname}
              onDurationChange={handleSummaryDurationChange}
              onScheduleModeChange={setScheduleMode}
              onRallyDayChange={setRallyDay}
              onRallyTimeChange={setRallyTime}
              onSubmit={handleSubmit}
            />
          </div>
          )}

          <p className="text-center text-sm">
            <Link className="link-accent" to="/join">
              Join an existing session
            </Link>
          </p>
        </div>
      </div>

      <footer className="hidden pb-6 text-center text-xs text-muted lg:block">
        AMRAP With Friends
      </footer>
    </main>
  );
}
