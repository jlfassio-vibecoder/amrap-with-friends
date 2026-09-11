import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from '@/pages/RoomPage';
import { ThemeProvider } from '@/contexts/ThemeProvider';

const { getRoomByHandle, listRoomMissions, joinRoom, listRoomActivity, setRoomActivityVisible } =
  vi.hoisted(() => ({
    getRoomByHandle: vi.fn(),
    listRoomMissions: vi.fn(),
    joinRoom: vi.fn(),
    listRoomActivity: vi.fn(),
    setRoomActivityVisible: vi.fn(),
  }));
vi.mock('@/lib/api/rooms', () => ({
  getRoomByHandle,
  listRoomMissions,
  joinRoom,
  listRoomActivity,
  setRoomActivityVisible,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(), trackBeacon: vi.fn() }));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({ user: null, isAuthenticated: false, isAuthLoading: false }),
}));

const room = {
  id: 'r1',
  handle: 'northside',
  displayName: 'Northside Strength',
  avatarPath: null,
  intro: null,
  timezone: 'America/New_York',
  isActive: true,
  memberCount: 4,
  myRole: null,
  announcement: null,
  brand: null,
  myActivityVisible: null,
};

function scheduled(scheduledAt: string) {
  return {
    missionId: 'm1',
    state: 'waiting',
    durationMinutes: 12,
    templateId: 'the-piston',
    scheduledAt,
    createdAt: '2026-09-11T10:00:00.000Z',
    completedAt: null,
    finishers: 0,
  };
}

function renderRoom() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/@northside']}>
        <Routes>
          <Route path="/:handle" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('add to calendar on a room page', () => {
  beforeEach(() => {
    getRoomByHandle.mockResolvedValue({ ok: true, room });
    listRoomActivity.mockResolvedValue({ ok: true, rows: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    getRoomByHandle.mockReset();
    listRoomMissions.mockReset();
    listRoomActivity.mockReset();
  });

  it('offers it for a mission still to come', async () => {
    vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
    listRoomMissions.mockResolvedValue({
      ok: true,
      upcoming: [scheduled('2026-09-11T12:05:00.000Z')],
      recent: [],
    });

    renderRoom();
    await waitFor(() => expect(screen.queryByText('Download calendar invite')).not.toBeNull());
    vi.useRealTimers();
  });

  it('takes it away once the start time passes with the page still open', async () => {
    // The page does not reload, and nothing else on it ticks. Without the
    // timer, a visitor who opened the room five minutes early could keep
    // saving an event for a mission that has already started.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
    listRoomMissions.mockResolvedValue({
      ok: true,
      upcoming: [scheduled('2026-09-11T12:01:00.000Z')],
      recent: [],
    });

    renderRoom();
    await waitFor(() => expect(screen.queryByText('Download calendar invite')).not.toBeNull());

    await act(async () => {
      vi.setSystemTime(new Date('2026-09-11T12:02:00.000Z'));
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.queryByText('Download calendar invite')).toBeNull();
  });

  it('offers nothing for a room with nothing scheduled', async () => {
    listRoomMissions.mockResolvedValue({ ok: true, upcoming: [], recent: [] });

    renderRoom();
    await waitFor(() => expect(screen.queryByText('Next mission')).not.toBeNull());
    expect(screen.queryByText('Download calendar invite')).toBeNull();
  });
});
