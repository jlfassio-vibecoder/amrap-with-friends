import { RecentFinishes } from '@/components/rooms/RecentFinishes';
import { roomActivitySentence } from '@/lib/rooms/roomInvite';
import { nextMission, nextMissionLabel } from '@/lib/rooms/roomSchedule';
import type { RoomActivity, RoomMission } from '@/lib/api/rooms';

interface MissionsTabProps {
  roomId: string;
  isActive: boolean;
  upcoming: RoomMission[];
  activity: RoomActivity | null;
}

/** What is happening in this room: what is next, and who has been training. */
export function MissionsTab({ roomId, isActive, upcoming, activity }: MissionsTabProps) {
  return (
    <>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Next mission</h2>
        <p>{nextMissionLabel(nextMission(upcoming))}</p>
        {!isActive ? (
          <p className="text-xs text-accent">This room isn&rsquo;t running missions right now.</p>
        ) : null}
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">This week</h2>
        <p>{activity ? roomActivitySentence(activity) : 'Loading…'}</p>
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Recent finishes</h2>
        <p className="text-secondary">
          One tap tells an athlete you saw it. Tap the same one again to take it back.
        </p>
        <RecentFinishes roomId={roomId} />
      </section>
    </>
  );
}
