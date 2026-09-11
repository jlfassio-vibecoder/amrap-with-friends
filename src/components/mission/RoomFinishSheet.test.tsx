import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getMissionRoomMock, joinRoomMock } = vi.hoisted(() => ({
  getMissionRoomMock: vi.fn(),
  joinRoomMock: vi.fn(),
}));

vi.mock('@/lib/api/rooms', () => ({
  getMissionRoom: (...args: unknown[]) => getMissionRoomMock(...args),
  joinRoom: (...args: unknown[]) => joinRoomMock(...args),
}));

const { RoomFinishSheet } = await import('./RoomFinishSheet');

/** fireEvent, because user-event is not a dependency here. */
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

const ROOM = {
  id: 'room-1',
  handle: 'bay_area_crossfit',
  displayName: 'Bay Area CrossFit',
  isMember: false,
  hasHomeCoach: false,
};

describe('RoomFinishSheet', () => {
  beforeEach(() => {
    cleanup();
    getMissionRoomMock.mockReset();
    joinRoomMock.mockReset();
    joinRoomMock.mockResolvedValue({
      ok: true,
      roomId: ROOM.id,
      homeCoachSet: true,
      homeCoachAlreadySet: false,
    });
  });

  function setup(onSave: () => Promise<boolean>, onJoinResult = vi.fn()) {
    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={onSave}
        onJoinResult={onJoinResult}
      />
    );
    return onJoinResult;
  }

  it('saves, then joins, when the box is left ticked', async () => {
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(true);
    const onJoinResult = setup(onSave);

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save this mission/ }));

    await waitFor(() => expect(joinRoomMock).toHaveBeenCalledWith(ROOM.id, true));
    expect(onSave).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onJoinResult).toHaveBeenCalledWith('You joined Bay Area CrossFit.'));
  });

  /**
   * The one with money attached: starting the join alongside the save could
   * create membership and attribution for a mission that never landed.
   */
  it('never joins when the save fails', async () => {
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(false);
    const onJoinResult = setup(onSave);

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save this mission/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(joinRoomMock).not.toHaveBeenCalled();
    expect(onJoinResult).not.toHaveBeenCalled();
  });

  it('saves without joining when the box is unticked', async () => {
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(true);
    setup(onSave);

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('checkbox'));
    await click(screen.getByRole('button', { name: /Save this mission/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(joinRoomMock).not.toHaveBeenCalled();
  });

  it('tells the athlete their home coach is unchanged', async () => {
    getMissionRoomMock.mockResolvedValue({ ...ROOM, hasHomeCoach: true });
    joinRoomMock.mockResolvedValue({
      ok: true,
      roomId: ROOM.id,
      homeCoachSet: false,
      homeCoachAlreadySet: true,
    });
    const onJoinResult = setup(vi.fn().mockResolvedValue(true));

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save this mission/ }));

    await waitFor(() =>
      expect(onJoinResult).toHaveBeenCalledWith(
        'You joined Bay Area CrossFit. Your home coach is unchanged.'
      )
    );
  });

  it('does not lose the save when the join fails', async () => {
    getMissionRoomMock.mockResolvedValue(ROOM);
    joinRoomMock.mockResolvedValue({ ok: false, reason: 'not_found' });
    const onJoinResult = setup(vi.fn().mockResolvedValue(true));

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save this mission/ }));

    await waitFor(() =>
      expect(onJoinResult).toHaveBeenCalledWith(expect.stringContaining('Saved.'))
    );
  });

  // Most missions are personal; that path must stay the prompt it always was.
  it('renders the plain save prompt for a mission with no room', async () => {
    getMissionRoomMock.mockResolvedValue(null);
    setup(vi.fn().mockResolvedValue(true));

    await screen.findByRole('button', { name: /Save this mission/ });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
