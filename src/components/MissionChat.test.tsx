import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MissionChat } from './MissionChat';
import type { MessageRow } from '@/lib/missionSync/types';

const sendMessageMock = vi.fn();
const fetchInvitationPreviewMock = vi.fn();
const acceptInvitationSquadMock = vi.fn();

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: { nickname: 'Host' },
  }),
}));

vi.mock('@/lib/api/sendMessage', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/sendMessage')>('@/lib/api/sendMessage');
  return {
    ...actual,
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  };
});

vi.mock('@/lib/api/invitations', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/invitations')>('@/lib/api/invitations');
  return {
    ...actual,
    fetchInvitationPreview: (...args: unknown[]) => fetchInvitationPreviewMock(...args),
    acceptInvitationSquad: (...args: unknown[]) => acceptInvitationSquadMock(...args),
  };
});

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

function buildMessage(id: string, body: string, createdAt: string, nickname = 'Host'): MessageRow {
  return {
    id,
    mission_id: MISSION_ID,
    participant_id: PARTICIPANT_ID,
    nickname,
    body,
    segment_index: 0,
    created_at: createdAt,
  };
}

function renderChat(
  props: Partial<{
    messages: MessageRow[];
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    isAuthenticated: boolean;
  }> = {}
) {
  const onExpandedChange = props.onExpandedChange ?? vi.fn();
  return render(
    <MemoryRouter>
      <MissionChat
        missionId={MISSION_ID}
        participantId={PARTICIPANT_ID}
        claimToken="claim-token"
        isAuthenticated={props.isAuthenticated ?? false}
        messages={props.messages ?? []}
        expanded={props.expanded ?? false}
        onExpandedChange={onExpandedChange}
      />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  sendMessageMock.mockReset();
  fetchInvitationPreviewMock.mockReset();
  acceptInvitationSquadMock.mockReset();
});

describe('MissionChat', () => {
  it('starts collapsed without a message list', () => {
    renderChat({
      messages: [buildMessage('msg-1', 'First', '2026-08-25T12:00:00.000Z')],
    });

    expect(screen.queryByTestId('mission-chat-message-list')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a message…')).toBeTruthy();
  });

  it('opens and closes the message list', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MissionChat
          missionId={MISSION_ID}
          participantId={PARTICIPANT_ID}
          claimToken="claim-token"
          isAuthenticated={false}
          messages={[buildMessage('msg-1', 'First', '2026-08-25T12:00:00.000Z')]}
          expanded={false}
          onExpandedChange={onExpandedChange}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    rerender(
      <MemoryRouter>
        <MissionChat
          missionId={MISSION_ID}
          participantId={PARTICIPANT_ID}
          claimToken="claim-token"
          isAuthenticated={false}
          messages={[buildMessage('msg-1', 'First', '2026-08-25T12:00:00.000Z')]}
          expanded
          onExpandedChange={onExpandedChange}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('mission-chat-message-list')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('renders messages in ascending order when expanded', () => {
    const messages = [
      buildMessage('msg-1', 'First', '2026-08-25T12:00:00.000Z'),
      buildMessage('msg-2', 'Second', '2026-08-25T12:01:00.000Z'),
    ];

    renderChat({ messages, expanded: true });

    const bodies = screen.getAllByText(/First|Second/);
    expect(bodies[0].textContent).toBe('First');
    expect(bodies[1].textContent).toBe('Second');
  });

  it('uses a scrollable message list container when expanded', () => {
    renderChat({ expanded: true });

    const list = screen.getByTestId('mission-chat-message-list');
    expect(list.className).toContain('overflow-y-auto');
    expect(list.className).toContain('min-h-0');
    expect(list.className).toContain('flex-1');
  });

  it('sends a message, clears the input, and expands', async () => {
    const onExpandedChange = vi.fn();
    sendMessageMock.mockResolvedValue({
      data: {
        ok: true,
        messageId: 'msg-new',
        missionId: MISSION_ID,
        participantId: PARTICIPANT_ID,
        nickname: 'Host',
        body: 'Hello rally point',
        segmentIndex: 0,
        createdAt: '2026-08-25T12:02:00.000Z',
      },
      error: null,
    });

    renderChat({ onExpandedChange });

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), {
      target: { value: 'Hello rally point' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        missionId: MISSION_ID,
        participantId: PARTICIPANT_ID,
        claimToken: 'claim-token',
        body: 'Hello rally point',
      });
    });
    expect((screen.getByPlaceholderText('Type a message…') as HTMLInputElement).value).toBe('');
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('offers Send as invitation for a recognized rally link instead of posting it', async () => {
    renderChat({ isAuthenticated: true });

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), {
      target: { value: `https://amrapwithfriends.com/join?m=${MISSION_ID}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Send this as an invitation instead of a raw link?')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send as invitation' })).toBeTruthy();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('accepts a squad invite on a chat card and hides the button', async () => {
    const invitationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    fetchInvitationPreviewMock.mockResolvedValue({
      data: {
        invitationId,
        deliveryId: 'del-1',
        type: 'workout',
        status: 'pending',
        readAt: null,
        createdAt: '2026-09-11T12:00:00.000Z',
        note: null,
        fromUserId: 'user-2',
        fromNickname: 'Alex',
        includeSquadInvite: true,
        durationMinutes: 15,
        workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
        templateId: null,
        intensityTier: null,
        assignedWorkoutId: 'aw-1',
        squadRequestId: 'sr-1',
        squadStatus: 'pending',
        resultingMissionId: null,
        resultingCampaignId: null,
        sourceMissionId: MISSION_ID,
        sourceMessageId: 'msg-inv',
        mission: null,
        campaign: null,
      },
      error: null,
    });
    acceptInvitationSquadMock.mockResolvedValue({ error: null });

    renderChat({
      isAuthenticated: true,
      expanded: true,
      messages: [
        {
          ...buildMessage('msg-inv', '', '2026-09-11T12:00:00.000Z', 'Alex'),
          attachment: { type: 'invitation', invitation_id: invitationId },
        },
      ],
    });

    expect(await screen.findByRole('button', { name: 'Accept squad invite' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept squad invite' }));

    await waitFor(() => {
      expect(acceptInvitationSquadMock).toHaveBeenCalledWith('del-1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Accept squad invite' })).toBeNull();
    });
  });

  it('shows an error when accepting a chat squad invite fails', async () => {
    const invitationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    fetchInvitationPreviewMock.mockResolvedValue({
      data: {
        invitationId,
        deliveryId: 'del-1',
        type: 'workout',
        status: 'pending',
        readAt: null,
        createdAt: '2026-09-11T12:00:00.000Z',
        note: null,
        fromUserId: 'user-2',
        fromNickname: 'Alex',
        includeSquadInvite: true,
        durationMinutes: 15,
        workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
        templateId: null,
        intensityTier: null,
        assignedWorkoutId: 'aw-1',
        squadRequestId: 'sr-1',
        squadStatus: 'pending',
        resultingMissionId: null,
        resultingCampaignId: null,
        sourceMissionId: MISSION_ID,
        sourceMessageId: 'msg-inv',
        mission: null,
        campaign: null,
      },
      error: null,
    });
    acceptInvitationSquadMock.mockResolvedValue({ error: { message: 'That invite expired.' } });

    renderChat({
      isAuthenticated: true,
      expanded: true,
      messages: [
        {
          ...buildMessage('msg-inv', '', '2026-09-11T12:00:00.000Z', 'Alex'),
          attachment: { type: 'invitation', invitation_id: invitationId },
        },
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Accept squad invite' }));
    expect(await screen.findByText('That invite expired.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept squad invite' })).toBeTruthy();
  });
});
