import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoomActivityFeed } from '@/components/rooms/RoomActivityFeed';

const { listRoomActivity, setRoomActivityVisible } = vi.hoisted(() => ({
  listRoomActivity: vi.fn(),
  setRoomActivityVisible: vi.fn(),
}));
vi.mock('@/lib/api/rooms', () => ({ listRoomActivity, setRoomActivityVisible }));
const { claimParticipant } = vi.hoisted(() => ({ claimParticipant: vi.fn() }));
vi.mock('@/lib/api/claimParticipant', () => ({ claimParticipant }));
const { getStoredParticipantId, getStoredClaimToken } = vi.hoisted(() => ({
  getStoredParticipantId: vi.fn(),
  getStoredClaimToken: vi.fn(),
}));
vi.mock('@/lib/missionIdentity', () => ({ getStoredParticipantId, getStoredClaimToken }));

const named = {
  participantId: 'p2',
  missionId: 'm1',
  templateId: null,
  nickname: 'Dana',
  score: 140,
  unit: 'reps' as const,
  finishedAt: '2026-09-11T12:00:00.000Z',
  reactionCount: 0,
};
const guest = { ...named, participantId: 'p1', nickname: null };

function renderFeed(props: Record<string, unknown> = {}) {
  return render(
    <RoomActivityFeed
      roomId="r1"
      signedIn={false}
      isMember={false}
      activityVisible={null}
      authNonce={0}
      workoutName={() => undefined}
      onSignUp={() => undefined}
      {...props}
    />
  );
}

describe('RoomActivityFeed', () => {
  afterEach(() => {
    cleanup();
    listRoomActivity.mockReset();
    setRoomActivityVisible.mockReset();
    claimParticipant.mockReset();
    getStoredParticipantId.mockReset();
    getStoredClaimToken.mockReset();
  });

  it('names a member and does not name a guest', async () => {
    listRoomActivity.mockResolvedValue({ ok: true, rows: [named, guest] });
    getStoredParticipantId.mockReturnValue(null);
    renderFeed();
    await waitFor(() => expect(screen.queryByText(/Dana/)).not.toBeNull());
    expect(screen.getByText(/An athlete/)).toBeTruthy();
  });

  it('re-reads the feed after the name is hidden, rather than trusting a local flag', async () => {
    // The names on screen were resolved before the write. Flipping only local
    // state left the member's own name showing until a reload — on the one
    // control whose entire job is to take it down.
    listRoomActivity
      .mockResolvedValueOnce({ ok: true, rows: [named] })
      .mockResolvedValueOnce({ ok: true, rows: [{ ...named, nickname: null }] });
    setRoomActivityVisible.mockResolvedValue({ ok: true });
    getStoredParticipantId.mockReturnValue(null);

    renderFeed({ isMember: true, activityVisible: true });
    await waitFor(() => expect(screen.queryByText(/Dana/)).not.toBeNull());

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.queryByText(/Dana/)).toBeNull());
    expect(setRoomActivityVisible).toHaveBeenCalledWith('r1', false);
    expect(listRoomActivity).toHaveBeenCalledTimes(2);
  });

  it('shows the switch as the database has it, not as the page guessed', async () => {
    // Rejoining reopens the old membership row with whatever setting it held.
    listRoomActivity.mockResolvedValue({ ok: true, rows: [named] });
    getStoredParticipantId.mockReturnValue(null);
    renderFeed({ isMember: true, activityVisible: false });
    await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeNull());
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('claims this device’s own finish when someone signs up', async () => {
    // The prompt promises an account carries your name onto a result already
    // on the page. Joining the room does not do that; claiming does.
    listRoomActivity.mockResolvedValue({ ok: true, rows: [guest] });
    getStoredParticipantId.mockReturnValue('p1');
    getStoredClaimToken.mockReturnValue('tok-1');
    claimParticipant.mockResolvedValue({ data: { ok: true }, error: null });

    const view = renderFeed();
    await waitFor(() => expect(screen.queryByText(/You —/)).not.toBeNull());
    expect(claimParticipant).not.toHaveBeenCalled();

    view.rerender(
      <RoomActivityFeed
        roomId="r1"
        signedIn
        isMember={false}
        activityVisible={null}
        authNonce={1}
        workoutName={() => undefined}
        onSignUp={() => undefined}
      />
    );

    await waitFor(() =>
      expect(claimParticipant).toHaveBeenCalledWith({ participantId: 'p1', claimToken: 'tok-1' })
    );
  });
});
