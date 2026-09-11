import { ScheduleMissionForm } from '@/components/rooms/ScheduleMissionForm';
import { repeatableMission, scheduledMissions } from '@/lib/rooms/roomSchedule';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import type { RoomMission } from '@/lib/api/rooms';

interface ScheduleTabProps {
  roomId: string;
  hostNickname: string;
  isActive: boolean;
  upcoming: RoomMission[];
  recent: RoomMission[];
  onScheduled: (missionId: string, opensNow: boolean) => void;
}

/**
 * Putting missions on the clock.
 *
 * Split out from "Next mission", which used to be one card holding both the
 * label for what was coming and the entire scheduling form -- so the answer to
 * "what is next" and the act of adding another were the same piece of UI.
 *
 * The list below the form is new. `upcoming` was already loaded and only its
 * first entry was ever rendered, so a host who scheduled three missions could
 * see one and had no way to check the rest.
 */
export function ScheduleTab({
  roomId,
  hostNickname,
  isActive,
  upcoming,
  recent,
  onScheduled,
}: ScheduleTabProps) {
  const scheduled = scheduledMissions(upcoming);

  // The same lookup the room page does. `RoomMission` carries the template id,
  // not a name -- the name lives in the library.
  function workoutName(templateId: string | null): string {
    if (!templateId) {
      return 'Mission';
    }
    return WORKOUT_TEMPLATES.find((template) => template.id === templateId)?.name ?? 'Mission';
  }

  return (
    <>
      <section className="card space-y-3 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Schedule a mission</h2>
        {isActive ? (
          <ScheduleMissionForm
            roomId={roomId}
            hostNickname={hostNickname}
            repeatable={repeatableMission(recent)}
            onScheduled={onScheduled}
          />
        ) : (
          <p className="text-secondary">
            This room isn&rsquo;t running missions right now, so it can&rsquo;t schedule one.
          </p>
        )}
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Scheduled ({scheduled.length})</h2>
        {scheduled.length === 0 ? (
          <p className="text-secondary">Nothing on the clock yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scheduled.map((mission) => (
              <li key={mission.missionId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {workoutName(mission.templateId)}
                  <span className="ml-2 text-xs text-secondary">
                    {mission.scheduledAt
                      ? new Date(mission.scheduledAt).toLocaleString()
                      : 'Open now'}
                  </span>
                </span>
                <a className="btn-outline shrink-0 text-xs" href={`/mission/${mission.missionId}`}>
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
