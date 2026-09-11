import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SendInvitationFlow } from './SendInvitationFlow';

const fetchInvitationAudienceMock = vi.fn();
const createInvitationMock = vi.fn();

vi.mock('@/lib/api/invitations', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/invitations')>('@/lib/api/invitations');
  return {
    ...actual,
    fetchInvitationAudience: (...args: unknown[]) => fetchInvitationAudienceMock(...args),
    createInvitation: (...args: unknown[]) => createInvitationMock(...args),
  };
});

const WORKOUT = [{ name: 'Burpees', target: 10, unit: 'reps' }];

afterEach(() => {
  cleanup();
  fetchInvitationAudienceMock.mockReset();
  createInvitationMock.mockReset();
});

describe('SendInvitationFlow', () => {
  it('summarizes squad vs mission recipients and keeps chat posting separate', async () => {
    fetchInvitationAudienceMock.mockResolvedValue({
      data: {
        squad: [{ userId: 'friend-1', nickname: 'Maya' }],
        missionParticipants: [
          {
            userId: 'self-1',
            participantId: 'p-self',
            nickname: 'Me',
            isFriend: false,
            isSelf: true,
          },
          {
            userId: 'joiner-1',
            participantId: 'p-joiner',
            nickname: 'Alex',
            isFriend: false,
            isSelf: false,
          },
        ],
        campaigns: [],
      },
      error: null,
    });

    render(
      <SendInvitationFlow
        open
        onClose={vi.fn()}
        sourceMissionId="mission-1"
        durationMinutes={15}
        workout={WORKOUT}
        allowedTypes={['mission', 'workout']}
        defaultType="workout"
      />
    );

    expect(await screen.findByText('Maya')).toBeTruthy();
    expect(screen.getByText('Invite to this 15-min mission')).toBeTruthy();
    expect(screen.getByText('Send this 15-min workout')).toBeTruthy();
    expect(screen.getByText('Pick at least one recipient.')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: /Maya/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Alex/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Post in mission chat' }));

    expect(
      screen.getByText(
        'Sending to 2 people (1 squad friend, 1 person in this mission). Will also post in chat.'
      )
    ).toBeTruthy();
  });

  it('counts a person on both the squad and mission lists once', async () => {
    fetchInvitationAudienceMock.mockResolvedValue({
      data: {
        squad: [{ userId: 'friend-1', nickname: 'Maya' }],
        missionParticipants: [
          {
            userId: 'self-1',
            participantId: 'p-self',
            nickname: 'Me',
            isFriend: false,
            isSelf: true,
          },
          {
            userId: 'friend-1',
            participantId: 'p-maya',
            nickname: 'Maya',
            isFriend: true,
            isSelf: false,
          },
        ],
        campaigns: [],
      },
      error: null,
    });

    render(
      <SendInvitationFlow
        open
        onClose={vi.fn()}
        sourceMissionId="mission-1"
        durationMinutes={15}
        workout={WORKOUT}
        allowedTypes={['workout']}
        defaultType="workout"
      />
    );

    expect(await screen.findAllByText('Maya')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Maya/ })[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Everyone currently in this mission' }));

    expect(screen.getByText('Sending to 1 person (1 squad friend).')).toBeTruthy();
  });

  it('reuses one client request id while the send dialog stays open', async () => {
    fetchInvitationAudienceMock.mockResolvedValue({
      data: {
        squad: [{ userId: 'friend-1', nickname: 'Maya' }],
        missionParticipants: [],
        campaigns: [],
      },
      error: null,
    });
    createInvitationMock.mockResolvedValue({
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    });

    render(
      <SendInvitationFlow
        open
        onClose={vi.fn()}
        durationMinutes={15}
        workout={WORKOUT}
        allowedTypes={['workout']}
        defaultType="workout"
      />
    );

    expect(await screen.findByText('Maya')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Maya/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(createInvitationMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(createInvitationMock).toHaveBeenCalledTimes(2));

    const firstId = (createInvitationMock.mock.calls[0]?.[0] as { clientRequestId?: string })
      .clientRequestId;
    const secondId = (createInvitationMock.mock.calls[1]?.[0] as { clientRequestId?: string })
      .clientRequestId;
    expect(firstId).toEqual(secondId);
    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
