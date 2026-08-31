import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { RallyScheduleFields } from '@/components/mission/RallyScheduleFields';
import { updateMissionScheduledAt } from '@/lib/api/missions';
import {
  defaultRallyTime,
  isRallyTimeAllowed,
  rallyIsoToDayAndTime,
  rallyLocalDateTimeToIso,
  type RallyDay,
} from '@/lib/mission/rallySchedule';

interface EditRallyScheduleFormProps {
  missionId: string;
  scheduledAt: string;
  onSaved?: (scheduledAt: string) => void;
  onCancel?: () => void;
  dayActions?: ReactNode;
}

export function EditRallyScheduleForm({
  missionId,
  scheduledAt,
  onSaved,
  onCancel,
  dayActions,
}: EditRallyScheduleFormProps) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const initial = useMemo(
    () => rallyIsoToDayAndTime(scheduledAt, timeZone, new Date()),
    [scheduledAt, timeZone]
  );

  const [rallyDay, setRallyDay] = useState<RallyDay>(initial?.day ?? 'today');
  const [rallyTime, setRallyTime] = useState(
    initial?.time ?? defaultRallyTime(new Date(), timeZone)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const now = new Date();
    const iso = rallyLocalDateTimeToIso(rallyDay, rallyTime, timeZone, now);
    if (!iso || !isRallyTimeAllowed(iso, timeZone, now)) {
      setError('Rally time must be today or tomorrow, and in the future.');
      return;
    }

    setLoading(true);
    try {
      const result = await updateMissionScheduledAt({
        missionId,
        scheduledAt: iso,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data) {
        onSaved?.(result.data.scheduledAt);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <p className="text-sm font-semibold">Mission time</p>
      <RallyScheduleFields
        rallyDay={rallyDay}
        rallyTime={rallyTime}
        disabled={loading}
        onRallyDayChange={setRallyDay}
        onRallyTimeChange={setRallyTime}
        dayActions={dayActions}
      />
      {error ? <p className="text-error">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        {onCancel ? (
          <button type="button" className="btn-outline" disabled={loading} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
