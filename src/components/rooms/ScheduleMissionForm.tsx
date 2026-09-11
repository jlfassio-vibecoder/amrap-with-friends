import { useMemo, useState, type FormEvent } from 'react';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { scheduleRoomMission } from '@/lib/api/rooms';
import { checkScheduledAt, type RoomMissionLike } from '@/lib/rooms/roomSchedule';
import { templateToExercises } from '@/lib/workout/templateToExercises';

/** Mirrors room_schedule_horizon_days() so a host is told before they submit. */
const HORIZON_DAYS = 60;

interface ScheduleMissionFormProps {
  roomId: string;
  hostNickname: string;
  /** The last session anyone finished, offered as "run this again". */
  repeatable: RoomMissionLike | null;
  onScheduled: () => void;
}

/**
 * Putting a mission in front of the room.
 *
 * Two paths to the same place: pick a workout, or repeat the last one anyone
 * finished. A time is optional -- leaving it blank opens the mission now, which
 * is the same button a coach uses to start an unplanned session.
 */
export function ScheduleMissionForm({
  roomId,
  hostNickname,
  repeatable,
  onScheduled,
}: ScheduleMissionFormProps) {
  const [templateId, setTemplateId] = useState(repeatable?.templateId ?? '');
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
      nickname: hostNickname,
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
    onScheduled();
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

      <label className="block">
        <span className="eyebrow text-secondary">Workout</span>
        <select
          className="input-field mt-1 w-full"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
        >
          <option value="">Choose a workout</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · {template.durationMinutes} min
            </option>
          ))}
        </select>
      </label>

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
