import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoachActivityCohorts } from './CoachActivityCohorts';

const fetchUsersMock = vi.fn();
const fetchSummaryMock = vi.fn();
const fetchEventsMock = vi.fn();

vi.mock('@/lib/api/coach', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/coach')>('@/lib/api/coach');
  return {
    ...actual,
    fetchCoachUsersList: (...args: unknown[]) => fetchUsersMock(...args),
    fetchCoachAnonSummary: (...args: unknown[]) => fetchSummaryMock(...args),
    fetchCoachRecentEvents: (...args: unknown[]) => fetchEventsMock(...args),
  };
});

vi.mock('@/hooks/useOnlineUserIds', () => ({
  useOnlineUserIds: () => new Set<string>(),
  useOnlineAnonIds: () => new Set(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']),
}));

const ANON_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  fetchUsersMock.mockReset();
  fetchSummaryMock.mockReset();
  fetchEventsMock.mockReset();
  fetchUsersMock.mockResolvedValue({ data: [], error: null });
  fetchSummaryMock.mockResolvedValue({
    data: {
      lastOccurredAt: null,
      lastRoute: null,
      eventCount: 0,
      eventNameCounts: {},
      linkedUserId: null,
      linkedNickname: null,
    },
    error: null,
  });
  fetchEventsMock.mockResolvedValue({ data: [], error: null });
});

describe('CoachActivityCohorts Anonymous Now dossier', () => {
  it('truncates the guest id and opens a presence-only card on click', async () => {
    render(<CoachActivityCohorts selectedUser={null} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Anonymous Now' }));

    const idButton = await screen.findByRole('button', { name: 'aaaaaaaa…eeee' });
    expect(idButton.getAttribute('title')).toBe(ANON_UUID);
    expect(screen.queryByText(ANON_UUID)).toBeNull();

    fireEvent.click(idButton);

    await waitFor(() => {
      expect(fetchSummaryMock).toHaveBeenCalledWith(ANON_UUID);
    });
    expect(fetchEventsMock).toHaveBeenCalledWith({ anonId: ANON_UUID, limit: 10 });
    expect(
      screen.getByText('This browser is online but has no events in the last 90 days.')
    ).toBeTruthy();
    expect(screen.getByText('Not signed in on this browser.')).toBeTruthy();
  });

  it('shows last route and a linked account when the dossier has events', async () => {
    fetchSummaryMock.mockResolvedValue({
      data: {
        lastOccurredAt: '2026-09-03T12:00:00.000Z',
        lastRoute: '/join',
        eventCount: 2,
        eventNameCounts: { mission_joined: 2 },
        linkedUserId: '11111111-1111-4111-8111-111111111111',
        linkedNickname: 'Ghost',
      },
      error: null,
    });
    fetchEventsMock.mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          eventName: 'mission_joined',
          occurredAt: '2026-09-03T12:00:00.000Z',
          missionId: null,
          participantId: null,
          userId: null,
          anonId: ANON_UUID,
          route: '/join',
          props: {},
        },
      ],
      error: null,
    });

    render(<CoachActivityCohorts selectedUser={null} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anonymous Now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'aaaaaaaa…eeee' }));

    await waitFor(() => {
      expect(screen.getByText('Signed in as Ghost')).toBeTruthy();
    });
    expect(screen.getAllByText('/join').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mission joined').length).toBeGreaterThan(0);
  });
});
