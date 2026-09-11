import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { InvitationCard } from './InvitationCard';
import type { InvitationCardData } from '@/lib/api/invitations';

function card(overrides: Partial<InvitationCardData> = {}): InvitationCardData {
  return {
    invitationId: 'inv-1',
    deliveryId: 'del-1',
    type: 'workout',
    status: 'pending',
    readAt: null,
    createdAt: '2026-09-11T12:00:00.000Z',
    note: 'Join me for this one.',
    fromUserId: 'user-2',
    fromNickname: 'Justin',
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
    ...overrides,
  };
}

function renderCard(props: ComponentProps<typeof InvitationCard>) {
  return render(
    <MemoryRouter>
      <InvitationCard {...props} />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

describe('InvitationCard', () => {
  it('uses Start for a workout and Dismiss instead of Not now', () => {
    const onDismiss = vi.fn();
    renderCard({
      card: card(),
      onPrimary: vi.fn(),
      onDismiss,
    });

    expect(screen.getByText('Justin shared a 15-minute workout')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start 15-min mission' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('does not offer Join when joining is closed', () => {
    renderCard({
      card: card({
        type: 'mission',
        durationMinutes: 15,
        mission: {
          id: 'm-1',
          state: 'work',
          scheduledAt: null,
          durationMinutes: 15,
          alreadyJoined: false,
          joinable: false,
        },
      }),
      onPrimary: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Joining closed' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.queryByRole('button', { name: 'Join 15-min mission' })).toBeNull();
  });

  it('keeps Accept squad invite independent of the workout action', () => {
    const onPrimary = vi.fn();
    const onAcceptSquad = vi.fn();
    renderCard({
      card: card({
        includeSquadInvite: true,
        squadRequestId: 'sr-1',
        squadStatus: 'pending',
      }),
      onPrimary,
      onAcceptSquad,
    });

    expect(
      screen.getByText('Justin invited you to their squad and sent you a 15-minute workout')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept squad invite' }));
    expect(onAcceptSquad).toHaveBeenCalled();
    expect(onPrimary).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start 15-min mission' })).toBeTruthy();
  });

  it('uses View workout after the mission has finished', () => {
    renderCard({
      card: card({
        type: 'mission',
        mission: {
          id: 'm-1',
          state: 'finished',
          scheduledAt: null,
          durationMinutes: 15,
          alreadyJoined: true,
          joinable: false,
        },
      }),
      onPrimary: vi.fn(),
    });

    expect(screen.getByRole('link', { name: 'View workout' }).getAttribute('href')).toBe(
      '/mission/m-1'
    );
    expect(screen.queryByRole('button', { name: 'Join 15-min mission' })).toBeNull();
  });
});
