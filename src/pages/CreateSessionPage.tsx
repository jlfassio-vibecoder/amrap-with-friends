import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CreateSessionSummaryPanel } from '@/components/createSession/CreateSessionSummaryPanel';
import {
  WorkoutSourceToggle,
  type WorkoutSource,
} from '@/components/createSession/WorkoutSourceToggle';
import { WorkoutTemplatePicker } from '@/components/createSession/WorkoutTemplatePicker';
import {
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import { createSession } from '@/lib/api/sessions';
import { getSupabaseConfigError } from '@/lib/supabase';
import { firstAvailableCategoryForDuration } from '@/lib/workout/filterWorkoutTemplates';
import { applyTemplate } from '@/lib/workout/templateToExercises';
import { parseWorkoutText } from '@/lib/workout/parseWorkoutLines';

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [workoutSource, setWorkoutSource] = useState<WorkoutSource>('library');
  const [nickname, setNickname] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('blood-shunt');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [workoutText, setWorkoutText] = useState('10 Burpees\n15 Push-ups');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setDurationMinutes(duration);
    setSelectedTemplateId(null);
  }

  function handleTemplateSelect(template: WorkoutTemplate) {
    const applied = applyTemplate(template);
    setDurationMinutes(applied.durationMinutes);
    setWorkoutText(applied.workoutText);
    setSelectedTemplateId(template.id);
    if (template.category) {
      setSelectedCategory(template.category);
    }
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
              error={error}
              loading={loading}
              onNicknameChange={setNickname}
              onDurationChange={handleSummaryDurationChange}
              onSubmit={handleSubmit}
            />
          </div>

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
