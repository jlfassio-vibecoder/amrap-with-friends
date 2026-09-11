import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Invite to this mission')).toBeTruthy();
    expect(screen.getByText('Send this workout')).toBeTruthy();
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
});
