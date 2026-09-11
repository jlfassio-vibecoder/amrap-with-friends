import { useMemo, useState, type FormEvent } from 'react';
import {
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
} from '@/data/workoutTemplates';
import { WorkoutBrowser } from '@/components/workout/WorkoutBrowser';
import { scheduleRoomMission } from '@/lib/api/rooms';
import { checkScheduledAt, hostNicknameFor, type RoomMissionLike } from '@/lib/rooms/roomSchedule';
import { templateToExercises } from '@/lib/workout/templateToExercises';

/** Mirrors room_schedule_horizon_days() so a host is told before they submit. */
const HORIZON_DAYS = 60;

interface ScheduleMissionFormProps {
  roomId: string;
  hostNickname: string;
  /** The last mission anyone finished, offered as "run this again". */
  repeatable: RoomMissionLike | null;
  /** `opensNow` is true when no time was given, so the caller can go run it. */
  onScheduled: (missionId: string, opensNow: boolean) => void;
}

/**
 * Putting a mission in front of the room.
 *
 * Two paths to the same place: pick a workout, or repeat the last one anyone
 * finished. A time is optional -- leaving it blank opens the mission now, which
 * is the same button a coach uses to start an unplanned one.
 */
export function ScheduleMissionForm({
  roomId,
  hostNickname,
  repeatable,
  onScheduled,
}: ScheduleMissionFormProps) {
  const [templateId, setTemplateId] = useState(repeatable?.templateId ?? '');
  // The browser's own filters. Seeded from the repeatable mission when there is
  // one, so "run it again" lands the host where that workout actually lives
  // rather than on a default they have to navigate away from.
  const repeatSeed = repeatable?.templateId
    ? WORKOUT_TEMPLATES.find((template) => template.id === repeatable.templateId)
    : undefined;
  const [duration, setDuration] = useState<TimeDomain>(
    (repeatSeed?.durationMinutes as TimeDomain | undefined) ?? 10
  );
  const [category, setCategory] = useState<WorkoutCategory>(
    repeatSeed?.category ?? WORKOUT_CATEGORIES[0]!.id
  );
  const [when, setWhen] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Newest-looking first is not useful here; a coach scans by duration.
  const templates = useMemo(
    () =>
      [...WORKOUT_TEMPLATES].sort(
        (a, b) => a.durationMinutes - b.durationMinutes || a.name.localeCompare(b.name)
      ),
    []
  );

  const repeatTemplate = repeatable?.templateId
    ? templates.find((template) => template.id === repeatable.templateId)
    : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      setError('Pick a workout.');
      return;
    }

    // `datetime-local` has no zone; the browser reads it as local time, which
    // is what the coach meant when they typed it.
    let scheduledAt: string | null = null;
    if (when.trim().length > 0) {
      const parsed = new Date(when);
      if (Number.isNaN(parsed.getTime())) {
        setError('That date did not make sense.');
        return;
      }
      const rejection = checkScheduledAt(parsed, new Date(), HORIZON_DAYS);
      if (rejection) {
        setError(rejection.message);
        return;
      }
      scheduledAt = parsed.toISOString();
    }

    setBusy(true);
    const result = await scheduleRoomMission({
      roomId,
      nickname: hostNicknameFor(hostNickname),
      durationMinutes: template.durationMinutes,
      workout: templateToExercises(template),
      templateId: template.id,
      intensityTier: template.intensityTier,
      scheduledAt,
    });
    setBusy(false);

    if (!result.ok) {
      setError(reasonMessage(result.reason));
      return;
    }
    setWhen('');
    onScheduled(result.missionId, scheduledAt === null);
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      {repeatTemplate ? (
        <button
          type="button"
          className="btn-outline w-full text-sm"
          onClick={() => setTemplateId(repeatTemplate.id)}
        >
          Run {repeatTemplate.name} again
        </button>
      ) : null}

      {/* The same browser the athlete's create-mission flow uses. It was a
          native <select> of every workout in the library, sorted by duration --
          two hundred names a coach had to already know to find. Choosing a
          workout is the same act in both places and should not be two
          different products. */}
      <div className="space-y-1">
        <span className="eyebrow text-secondary">Workout</span>
        <WorkoutBrowser
          durationMinutes={duration}
          selectedCategory={category}
          selectedTemplateIds={templateId ? [templateId] : []}
          onDurationChange={setDuration}
          onCategoryChange={setCategory}
          onTemplateSelect={(template) => setTemplateId(template.id)}
        />
      </div>

      <label className="block">
        <span className="eyebrow text-secondary">When</span>
        <input
          type="datetime-local"
          className="input-field mt-1 w-full"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
        <span className="mt-1 block text-xs text-secondary">
          Leave this blank to open the mission now. Athletes see the time in their own timezone.
        </span>
      </label>

      {error ? <p className="text-accent">{error}</p> : null}

      <button type="submit" className="btn-primary text-sm" disabled={busy}>
        {busy ? 'Scheduling…' : when.trim() ? 'Schedule it' : 'Open it now'}
      </button>
    </form>
  );
}

function reasonMessage(reason: string): string {
  switch (reason) {
    case 'room_inactive':
      return 'This room is read-only, so it cannot open new missions.';
    case 'forbidden':
      return 'Only this room’s owner and co-hosts can schedule missions.';
    case 'scheduled_in_past':
      return 'Pick a time in the future.';
    case 'too_far_ahead':
      return `Schedule within the next ${HORIZON_DAYS} days.`;
    case 'invalid_workout':
      return 'That workout was not accepted. Try another.';
    default:
      return `Could not schedule that mission: ${reason}`;
  }
}
