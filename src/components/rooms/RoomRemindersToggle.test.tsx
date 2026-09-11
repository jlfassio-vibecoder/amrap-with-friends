import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoomRemindersToggle } from '@/components/rooms/RoomRemindersToggle';

const { setRoomReminders } = vi.hoisted(() => ({ setRoomReminders: vi.fn() }));
vi.mock('@/lib/api/rooms', () => ({ setRoomReminders }));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track }));

/** The repo has no jest-dom matchers, so checkbox state is read off the node. */
function box(): HTMLInputElement {
  return screen.getByRole('checkbox') as HTMLInputElement;
}

function renderToggle(props: Record<string, unknown> = {}) {
  return render(
    <RoomRemindersToggle roomId="r1" remindersEnabled={true} hasUpcoming={true} {...props} />
  );
}

beforeEach(() => {
  setRoomReminders.mockReset();
  setRoomReminders.mockResolvedValue({ ok: true });
  track.mockReset();
});

afterEach(cleanup);

describe('RoomRemindersToggle', () => {
  it('renders the member’s stored setting', () => {
    renderToggle({ remindersEnabled: false });
    expect(box().checked).toBe(false);
  });

  it('shows nothing to a non-member, who has no setting to change', () => {
    renderToggle({ remindersEnabled: null });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows nothing when the room has no upcoming mission', () => {
    // A switch offering to turn off mail nothing will send is noise.
    renderToggle({ hasUpcoming: false });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('writes the new value through', async () => {
    renderToggle();
    fireEvent.click(box());
    await waitFor(() => expect(setRoomReminders).toHaveBeenCalledWith('r1', false));
  });

  it('reflects the change immediately rather than waiting for a reload', async () => {
    renderToggle();
    fireEvent.click(box());
    await waitFor(() => expect(box().checked).toBe(false));
  });

  it('puts the switch back when the write fails', async () => {
    // A switch left lying about what will happen is worse than one that snaps
    // back: the athlete thinks they opted out and the mail keeps coming.
    setRoomReminders.mockResolvedValue({ ok: false, reason: 'not_a_member' });
    renderToggle();
    fireEvent.click(box());
    await waitFor(() => expect(box().checked).toBe(true));
  });

  it('does not record a toggle that failed', async () => {
    setRoomReminders.mockResolvedValue({ ok: false, reason: 'not_a_member' });
    renderToggle();
    fireEvent.click(box());
    await waitFor(() => expect(setRoomReminders).toHaveBeenCalled());
    expect(track).not.toHaveBeenCalled();
  });

  it('records a successful toggle with the room it was on', async () => {
    renderToggle({ remindersEnabled: false });
    fireEvent.click(box());
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('room_reminders_toggled', {
        enabled: true,
        roomId: 'r1',
      })
    );
  });

  it('can be turned back on after being turned off', async () => {
    renderToggle();
    fireEvent.click(box());
    await waitFor(() => expect(box().checked).toBe(false));
    fireEvent.click(box());
    await waitFor(() => expect(box().checked).toBe(true));
    expect(setRoomReminders).toHaveBeenLastCalledWith('r1', true);
  });
});
