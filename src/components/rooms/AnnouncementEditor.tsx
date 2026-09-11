import { useState } from 'react';
import { setRoomAnnouncement } from '@/lib/api/rooms';

const MAX = 500;

/**
 * The one pinned announcement.
 *
 * Clearing the box and saving takes it down — "change it" and "remove it" are
 * the same decision, and a separate delete control would imply otherwise. The
 * plan gives a room one announcement and no chat, so there is nothing here to
 * thread or reply to.
 */
export function AnnouncementEditor({
  roomId,
  current,
  onSaved,
}: {
  roomId: string;
  current: string | null;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = body.trim() === (current ?? '').trim();

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setRoomAnnouncement(roomId, body.trim());
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === 'forbidden'
          ? 'Only this room’s owner and co-hosts can pin an announcement.'
          : `Could not save that: ${result.reason}`
      );
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-2">
      <label className="eyebrow text-secondary" htmlFor="room-announcement">
        Announcement
      </label>
      <textarea
        id="room-announcement"
        className="input-field w-full"
        rows={3}
        maxLength={MAX}
        value={body}
        placeholder="Tuesday 6pm as usual — bring a mat."
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-secondary">
          {body.trim().length === 0 && current
            ? 'Saving now takes the announcement down.'
            : `${body.length}/${MAX}`}
        </span>
        <button
          type="button"
          className="btn-outline text-sm"
          disabled={busy || unchanged}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : body.trim().length === 0 && current ? 'Take it down' : 'Pin it'}
        </button>
      </div>
      {error ? <p className="text-accent">{error}</p> : null}
    </div>
  );
}
