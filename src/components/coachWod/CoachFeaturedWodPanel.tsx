import { useEffect, useMemo, useState } from 'react';
import { fetchCoachWorkouts, type CoachWorkoutSummary } from '@/lib/api/coachWod';
import { formatFeaturedWodTime } from '@/lib/api/featuredWod';
import {
  deleteCoachFeaturedSchedule,
  fetchCoachFeaturedSchedule,
  pauseCoachFeaturedSchedule,
  setCoachFeaturedSchedule,
  type CoachFeaturedSchedule,
} from '@/lib/api/featuredWodSchedule';
import { computeNextFeaturedOccurrences } from '@/lib/session/featuredWodOccurrencePreview';

const PREVIEW_COUNT = 3;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_TIMES = 4;
const TIMEZONE_DATALIST_ID = 'featured-wod-timezone-options';

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA zone name the browser knows, so the timezone field is a
 * searchable dropdown instead of a free-text field a typo can silently
 * break (validated server-side against pg_timezone_names, but the coach
 * never finds that out until save fails). Intl.supportedValuesOf isn't in
 * every browser yet, so this degrades to just the browser's own zone.
 *
 * "UTC" is deliberately unioned in: Intl.supportedValuesOf('timeZone')
 * excludes it even though it's what Intl.DateTimeFormat().resolvedOptions()
 * actually returns for a system clock set to UTC (common on servers), and
 * it's a perfectly valid zone pg_timezone_names accepts server-side —
 * without this, that default value would show as "not recognized" and
 * silently block submit for anyone whose system is on UTC. */
function timezoneOptions(): string[] {
  try {
    const supported = Intl.supportedValuesOf('timeZone');
    return supported.includes('UTC') ? supported : [...supported, 'UTC'];
  } catch {
    return [defaultTimezone()];
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
  const timezoneChoices = useMemo(() => timezoneOptions(), []);
  const timezoneRecognized = timezoneChoices.includes(timezone.trim());
  const previewOccurrences = useMemo(() => {
    if (!timezoneRecognized) {
      return [];
    }
    return computeNextFeaturedOccurrences(days, times, timezone.trim(), new Date(), PREVIEW_COUNT);
  }, [days, times, timezone, timezoneRecognized]);

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
    if (!timezoneRecognized) {
      setError('Choose a recognized timezone from the list.');
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
        <datalist id={TIMEZONE_DATALIST_ID}>
          {timezoneChoices.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <input
          type="text"
          className="input-field"
          value={timezone}
          list={TIMEZONE_DATALIST_ID}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="America/Los_Angeles"
        />
        {timezone.trim() && !timezoneRecognized ? (
          <p className="text-xs text-secondary">
            Not a recognized timezone — pick one from the list.
          </p>
        ) : null}
      </label>

      {days.length > 0 && times.length > 0 ? (
        <div className="space-y-1 rounded-card border border-border bg-page p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Next occurrences
          </span>
          {previewOccurrences.length > 0 ? (
            <ul className="space-y-0.5 text-sm text-ink">
              {previewOccurrences.map((occurrence) => (
                <li key={occurrence.toISOString()}>
                  {formatFeaturedWodTime(occurrence.toISOString())}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary">
              {timezoneRecognized
                ? 'Add at least one day and time to preview.'
                : 'Pick a recognized timezone to preview.'}
            </p>
          )}
        </div>
      ) : null}

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
          setSchedule(scheduleResult.data);
          if (workoutsResult.error) {
            setError(workoutsResult.error.message);
          } else {
            setError(null);
          }
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
