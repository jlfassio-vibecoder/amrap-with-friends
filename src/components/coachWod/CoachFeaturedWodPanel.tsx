import { useEffect, useMemo, useState } from 'react';
import { fetchCoachWorkouts, type CoachWorkoutSummary } from '@/lib/api/coachWod';
import {
  deleteCoachFeaturedSchedule,
  fetchCoachFeaturedSchedule,
  pauseCoachFeaturedSchedule,
  setCoachFeaturedSchedule,
  type CoachFeaturedSchedule,
} from '@/lib/api/featuredWodSchedule';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_TIMES = 4;

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatDays(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ');
}

function formatTimes(times: string[]): string {
  return [...times].sort().join(', ');
}

interface ScheduleFormProps {
  workouts: CoachWorkoutSummary[];
  schedule: CoachFeaturedSchedule | null;
  onSaved: (schedule: CoachFeaturedSchedule) => void;
  onCancel: () => void;
}

function ScheduleForm({ workouts, schedule, onSaved, onCancel }: ScheduleFormProps) {
  const [workoutId, setWorkoutId] = useState(schedule?.coachWorkoutId ?? workouts[0]?.id ?? '');
  const [days, setDays] = useState<number[]>(schedule?.daysOfWeek ?? []);
  const [times, setTimes] = useState<string[]>(schedule?.timesLocal ?? ['06:00']);
  const [timezone, setTimezone] = useState(schedule?.timezone ?? defaultTimezone());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );
  }

  function updateTime(index: number, value: string) {
    setTimes((current) => current.map((t, i) => (i === index ? value : t)));
  }

  function addTime() {
    if (times.length >= MAX_TIMES) {
      return;
    }
    setTimes((current) => [...current, '06:00']);
  }

  function removeTime(index: number) {
    setTimes((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!workoutId) {
      setError('Choose a published workout to feature.');
      return;
    }
    if (days.length === 0) {
      setError('Choose at least one day.');
      return;
    }
    if (times.length === 0) {
      setError('Choose at least one time.');
      return;
    }

    setSubmitting(true);
    const result = await setCoachFeaturedSchedule({
      coachWorkoutId: workoutId,
      daysOfWeek: days,
      timesLocal: times,
      timezone,
    });
    setSubmitting(false);

    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }

    onSaved(result.data);
  }

  return (
    <div className="space-y-4 rounded-card border border-border bg-page p-4">
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Workout
        </span>
        <select
          className="input-field"
          value={workoutId}
          onChange={(event) => setWorkoutId(event.target.value)}
        >
          {workouts.length === 0 ? <option value="">No published workouts</option> : null}
          {workouts.map((workout) => (
            <option key={workout.id} value={workout.id}>
              {workout.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Days
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Days of week">
          {DAY_LABELS.map((label, day) => {
            const selected = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-on-accent'
                    : 'rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-ink'
                }
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Times (local)
        </span>
        <div className="space-y-2">
          {times.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="time"
                className="input-field w-40"
                value={time}
                onChange={(event) => updateTime(index, event.target.value)}
              />
              {times.length > 1 ? (
                <button
                  type="button"
                  className="text-xs uppercase tracking-wide text-error hover:underline"
                  onClick={() => removeTime(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {times.length < MAX_TIMES ? (
            <button
              type="button"
              className="btn-outline text-xs"
              onClick={addTime}
            >
              Add another time
            </button>
          ) : null}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Timezone
        </span>
        <input
          type="text"
          className="input-field"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="America/Los_Angeles"
        />
      </label>

      {error ? <p className="text-error text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => void handleSubmit()}
          disabled={submitting || workouts.length === 0}
        >
          {submitting ? 'Saving…' : 'Save featured schedule'}
        </button>
        <button type="button" className="btn-outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CoachFeaturedWodPanel() {
  const [schedule, setSchedule] = useState<CoachFeaturedSchedule | null>(null);
  const [workouts, setWorkouts] = useState<CoachWorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCoachFeaturedSchedule(), fetchCoachWorkouts({})]).then(
      ([scheduleResult, workoutsResult]) => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        if (scheduleResult.error) {
          setError(scheduleResult.error.message);
        } else {
          setError(null);
          setSchedule(scheduleResult.data);
        }
        setWorkouts(workoutsResult.data ?? []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedWorkouts = useMemo(
    () => workouts.filter((w) => w.status === 'published' && w.isOwner),
    [workouts]
  );

  async function handlePause() {
    setBusy(true);
    const result = await pauseCoachFeaturedSchedule();
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setSchedule((current) => (current ? { ...current, active: false } : current));
  }

  async function handleResume() {
    if (!schedule) {
      return;
    }
    setBusy(true);
    const result = await setCoachFeaturedSchedule({
      coachWorkoutId: schedule.coachWorkoutId,
      daysOfWeek: schedule.daysOfWeek,
      timesLocal: schedule.timesLocal,
      timezone: schedule.timezone,
    });
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setError(null);
    setSchedule(result.data);
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteCoachFeaturedSchedule();
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setSchedule(null);
  }

  if (loading) {
    return (
      <section className="card space-y-2 p-4">
        <p className="text-sm text-secondary">Loading featured WOD…</p>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Featured WOD</h2>
        {schedule && !editing ? (
          <span
            className={
              schedule.active
                ? 'rounded-card bg-success-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-text'
                : 'rounded-card border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary'
            }
          >
            {schedule.active ? 'Live' : 'Paused'}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-secondary">
        Only one featured WOD can be live app-wide at a time. It publishes to the landing page
        and Create session with an auto-starting lobby.
      </p>

      {error ? <p className="text-error text-sm">{error}</p> : null}

      {editing ? (
        <ScheduleForm
          workouts={publishedWorkouts}
          schedule={schedule}
          onSaved={(saved) => {
            setSchedule(saved);
            setEditing(false);
            setError(null);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : schedule ? (
        <div className="space-y-2 rounded-card border border-border bg-page p-4 text-sm">
          <p className="font-semibold text-ink">{schedule.workoutName}</p>
          <p className="text-secondary">
            {formatDays(schedule.daysOfWeek)} at {formatTimes(schedule.timesLocal)} (
            {schedule.timezone})
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              className="text-xs uppercase tracking-wide text-accent hover:underline"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Edit
            </button>
            {schedule.active ? (
              <button
                type="button"
                className="text-xs uppercase tracking-wide text-secondary hover:text-ink hover:underline"
                onClick={() => void handlePause()}
                disabled={busy}
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                className="text-xs uppercase tracking-wide text-secondary hover:text-ink hover:underline"
                onClick={() => void handleResume()}
                disabled={busy}
              >
                Resume
              </button>
            )}
            <button
              type="button"
              className="text-xs uppercase tracking-wide text-error hover:underline"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-secondary">No featured WOD set.</p>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setEditing(true)}
            disabled={publishedWorkouts.length === 0}
          >
            Set featured WOD
          </button>
          {publishedWorkouts.length === 0 ? (
            <p className="text-xs text-secondary">Publish a workout first to feature it.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
