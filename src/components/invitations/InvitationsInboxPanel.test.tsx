import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvitationsInboxPanel } from './InvitationsInboxPanel';
import type { InvitationCardData } from '@/lib/api/invitations';

const fetchMyInvitationsMock = vi.fn();
const markInvitationsReadMock = vi.fn();

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: { nickname: 'Me' },
  }),
}));

vi.mock('@/hooks/useRefetchOnVisible', () => ({
  useRefetchOnVisible: () => undefined,
}));

vi.mock('@/lib/api/invitations', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/invitations')>('@/lib/api/invitations');
  return {
    ...actual,
    fetchMyInvitations: (...args: unknown[]) => fetchMyInvitationsMock(...args),
    markInvitationsRead: (...args: unknown[]) => markInvitationsReadMock(...args),
  };
});

function pendingCard(): InvitationCardData {
  return {
    invitationId: 'inv-1',
    deliveryId: 'del-1',
    type: 'workout',
    status: 'pending',
    readAt: null,
    createdAt: '2026-09-11T12:00:00.000Z',
    note: null,
    fromUserId: 'user-2',
    fromNickname: 'Alex',
    includeSquadInvite: false,
    durationMinutes: 15,
    workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
    templateId: null,
    intensityTier: null,
    assignedWorkoutId: 'aw-1',
    squadRequestId: null,
    squadStatus: null,
    resultingMissionId: null,
    resultingCampaignId: null,
    sourceMissionId: 'm-1',
    sourceMessageId: null,
    mission: null,
    campaign: null,
  };
}

afterEach(() => {
  cleanup();
  fetchMyInvitationsMock.mockReset();
  markInvitationsReadMock.mockReset();
});

describe('InvitationsInboxPanel', () => {
  it('clears the unread badge only after mark-read succeeds', async () => {
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [pendingCard()],
      resolved: [],
      unreadCount: 1,
      error: null,
    });
    markInvitationsReadMock.mockResolvedValue({ error: null });
    const onUnreadChange = vi.fn();

    render(
      <MemoryRouter>
        <InvitationsInboxPanel showWhenEmpty onUnreadChange={onUnreadChange} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Alex shared a 15-minute workout')).toBeTruthy();
    await waitFor(() => {
      expect(markInvitationsReadMock).toHaveBeenCalledWith(['del-1']);
      expect(onUnreadChange).toHaveBeenCalledWith(0);
    });
  });

  it('leaves the unread count in place when mark-read fails', async () => {
    fetchMyInvitationsMock.mockResolvedValue({
      pending: [pendingCard()],
      resolved: [],
      unreadCount: 1,
      error: null,
    });
    markInvitationsReadMock.mockResolvedValue({ error: { message: 'offline' } });
    const onUnreadChange = vi.fn();

    render(
      <MemoryRouter>
        <InvitationsInboxPanel showWhenEmpty onUnreadChange={onUnreadChange} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Alex shared a 15-minute workout')).toBeTruthy();
    await waitFor(() => {
      expect(markInvitationsReadMock).toHaveBeenCalledWith(['del-1']);
    });
    expect(onUnreadChange).toHaveBeenCalledWith(1);
    expect(onUnreadChange).not.toHaveBeenCalledWith(0);
  });
});
