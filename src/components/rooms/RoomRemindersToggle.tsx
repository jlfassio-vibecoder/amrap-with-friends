import { useState } from 'react';
import { setRoomReminders } from '@/lib/api/rooms';
import { track } from '@/lib/analytics/track';

interface RoomRemindersToggleProps {
  roomId: string;
  /** The stored setting. Null for a non-member, who has nothing to toggle. */
  remindersEnabled: boolean | null;
  /** Whether this room has a future mission to be reminded about. */
  hasUpcoming: boolean;
}

/**
 * The member's reminder switch, next to the mission it is about.
 *
 * Every reminder carries an unsubscribe link, so this is not the only way out
 * -- but it is the only one that does not require first receiving the mail you
 * did not want. The activity-feed decision (coach-rooms-decisions.md §4) makes
 * that the condition for a default-on setting being defensible, and reminders
 * default on for exactly the reason activity does: joining a room is a
 * deliberate act aimed at one coach, so opting in again would leave the feature
 * switched off for almost everyone who asked for it.
 *
 * Rendered only when the room actually has something upcoming. A switch
 * offering to turn off mail that nothing is going to send is noise on a page
 * whose job is to get someone to the next mission.
 */
export function RoomRemindersToggle({
  roomId,
  remindersEnabled,
  hasUpcoming,
}: RoomRemindersToggleProps) {
  // Optimistic, unlike the activity toggle. That one has to re-read because the
  // names already on screen were resolved before the write; nothing on this
  // page is derived from this setting, so there is nothing to go stale.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  if (remindersEnabled === null || !hasUpcoming) {
    return null;
  }

  const checked = enabled ?? remindersEnabled;

  async function toggle(next: boolean) {
    setSaving(true);
    setEnabled(next);
    const result = await setRoomReminders(roomId, next);
    if (!result.ok) {
      // Put the switch back rather than leave it lying about what will happen.
      setEnabled(!next);
    } else {
      track('room_reminders_toggled', { enabled: next, roomId });
    }
    setSaving(false);
  }

  return (
    <label className="flex items-center gap-2 pt-1 text-xs text-secondary">
      <input
        type="checkbox"
        checked={checked}
        disabled={saving}
        onChange={(event) => void toggle(event.target.checked)}
      />
      Email me before this room&rsquo;s missions
    </label>
  );
}
