import { AnnouncementEditor } from '@/components/rooms/AnnouncementEditor';

interface CommsTabProps {
  roomId: string;
  announcement: string | null;
  onSaved: () => void;
}

/**
 * Talking to the room.
 *
 * One section today. It is its own tab because the announcement is the only
 * thing a host can say to everyone, and the things that will join it -- what
 * the reminder emails say, a note on the welcome -- are the same act and do not
 * belong filed under the room's colour.
 */
export function CommsTab({ roomId, announcement, onSaved }: CommsTabProps) {
  return (
    <section className="card space-y-2 p-4 text-sm">
      <h2 className="eyebrow text-secondary">Announcement</h2>
      <p className="text-secondary">
        One note, pinned to the top of your room page. Athletes see it whether or not they have
        joined.
      </p>
      <AnnouncementEditor roomId={roomId} current={announcement} onSaved={onSaved} />
    </section>
  );
}
