import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getMissionRoomMock, joinRoomMock, authMock } = vi.hoisted(() => ({
  getMissionRoomMock: vi.fn(),
  joinRoomMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => authMock(),
}));

// The sign-up the guest path opens. Rendering the real one would pull in
// Supabase; what matters here is whether it is asked for at all.
vi.mock('@/components/AuthModal', () => ({
  AuthModal: ({
    onAuthenticated,
    onSignupSessionSuccess,
    initialPasswordMode,
  }: {
    onAuthenticated?: () => void;
    onSignupSessionSuccess?: () => void;
    initialPasswordMode?: string;
  }) => (
    <div data-testid="auth-modal" data-mode={initialPasswordMode}>
      <button type="button" data-testid="auth-signin" onClick={() => onAuthenticated?.()}>
        sign in
      </button>
      <button type="button" data-testid="auth-signup" onClick={() => onSignupSessionSuccess?.()}>
        sign up
      </button>
    </div>
  ),
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
    authMock.mockReset();
    authMock.mockReturnValue({ isAuthenticated: true });
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

describe('the guest, who is who this sheet exists for', () => {
  /**
   * The finding this was written for: the sheet was gated on being signed in
   * already, so a guest finishing a room mission never saw it — and the guest
   * is the entire audience for the plan's post-finish flow.
   */
  it('opens sign-up instead of saving, and saves once auth settles', async () => {
    authMock.mockReturnValue({ isAuthenticated: false });
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(true);
    const onJoinResult = vi.fn();

    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={onSave}
        onJoinResult={onJoinResult}
      />
    );

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save my result/ }));

    // Nothing saved yet — there is no account to save into.
    expect(onSave).not.toHaveBeenCalled();
    await click(screen.getByTestId('auth-signin'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(joinRoomMock).toHaveBeenCalledWith(ROOM.id, true));
  });

  it('offers the guest the room checkbox, ticked, like anyone else', async () => {
    cleanup();
    authMock.mockReturnValue({ isAuthenticated: false });
    getMissionRoomMock.mockResolvedValue(ROOM);
    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={vi.fn().mockResolvedValue(true)}
        onJoinResult={vi.fn()}
      />
    );

    await screen.findByText(/Join Bay Area CrossFit/);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});

describe('the guest paths that are not a callback', () => {
  /**
   * Magic link and OAuth leave the page. The component remounts with no state,
   * so only a marker that outlived the redirect can resume the save the athlete
   * already asked for.
   */
  it('resumes a save left pending by a redirect', async () => {
    cleanup();
    window.sessionStorage.setItem('awf:room-finish-save:mission-1', '1');
    authMock.mockReturnValue({ isAuthenticated: true });
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={onSave}
        onJoinResult={vi.fn()}
      />
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(joinRoomMock).toHaveBeenCalledWith(ROOM.id, true));
    // Consumed, so a second mount does not claim again.
    expect(window.sessionStorage.getItem('awf:room-finish-save:mission-1')).toBeNull();
  });

  it('saves on a password signup, which reports before Continue is pressed', async () => {
    cleanup();
    window.sessionStorage.clear();
    authMock.mockReturnValue({ isAuthenticated: false });
    getMissionRoomMock.mockResolvedValue(ROOM);
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={onSave}
        onJoinResult={vi.fn()}
      />
    );

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save my result/ }));
    await click(screen.getByTestId('auth-signup'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('opens sign-up rather than sign-in, because a guest has no account', async () => {
    cleanup();
    window.sessionStorage.clear();
    authMock.mockReturnValue({ isAuthenticated: false });
    getMissionRoomMock.mockResolvedValue(ROOM);

    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={vi.fn().mockResolvedValue(true)}
        onJoinResult={vi.fn()}
      />
    );

    await screen.findByText(/Join Bay Area CrossFit/);
    await click(screen.getByRole('button', { name: /Save my result/ }));
    expect(screen.getByTestId('auth-modal').getAttribute('data-mode')).toBe('sign-up');
  });

  // The window between mount and the room lookup resolving is still a window a
  // guest can tap in.
  it('routes the pre-load prompt through the auth gate too', async () => {
    cleanup();
    window.sessionStorage.clear();
    authMock.mockReturnValue({ isAuthenticated: false });
    // Never resolves: the sheet stays on its fallback prompt.
    getMissionRoomMock.mockReturnValue(new Promise(() => {}));
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <RoomFinishSheet
        missionId="mission-1"
        canSave
        isSaving={false}
        onSave={onSave}
        onJoinResult={vi.fn()}
      />
    );

    await click(await screen.findByRole('button', { name: /Save this mission/ }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-modal')).toBeTruthy();
  });
});
