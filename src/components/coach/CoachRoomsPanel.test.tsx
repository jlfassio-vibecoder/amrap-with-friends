import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoachRoomsPanel } from '@/components/coach/CoachRoomsPanel';
import type { AdminRoomRow } from '@/lib/rooms/adminRoomStatus';

const { listRoomsForAdmin, grantRoomEntitlement } = vi.hoisted(() => ({
  listRoomsForAdmin: vi.fn(),
  grantRoomEntitlement: vi.fn(),
}));
vi.mock('@/lib/api/rooms', () => ({ listRoomsForAdmin, grantRoomEntitlement }));

const room = (over: Partial<AdminRoomRow> = {}): AdminRoomRow => ({
  roomId: 'r1',
  handle: 'coach_justin',
  displayName: 'AMRAP With Friends',
  createdAt: '2026-09-11T19:30:00.000Z',
  hostAccountId: 'h1',
  ownerEmail: 'coach@amrapwithfriends.com',
  memberCount: 1,
  isActive: false,
  entitlement: null,
  ...over,
});

beforeEach(() => {
  listRoomsForAdmin.mockReset();
  grantRoomEntitlement.mockReset();
  listRoomsForAdmin.mockResolvedValue({ ok: true, rooms: [room()] });
  grantRoomEntitlement.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe('CoachRoomsPanel', () => {
  it('offers activation on a room that was never granted one', async () => {
    render(<CoachRoomsPanel />);
    expect(await screen.findByRole('button', { name: 'Activate 12 months' })).toBeDefined();
  });

  it('says what inactive actually costs the host', async () => {
    render(<CoachRoomsPanel />);
    expect(await screen.findByText(/missions refused/)).toBeDefined();
  });

  it('offers nothing on an active room', async () => {
    listRoomsForAdmin.mockResolvedValue({
      ok: true,
      rooms: [room({ isActive: true, entitlement: { source: 'founding', expiresAt: null } })],
    });
    render(<CoachRoomsPanel />);
    await screen.findByText('Active');
    expect(screen.queryByRole('button', { name: /months/ })).toBeNull();
  });

  it('grants a founding entitlement for the row’s host account', async () => {
    render(<CoachRoomsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate 12 months' }));
    await waitFor(() =>
      expect(grantRoomEntitlement).toHaveBeenCalledWith('h1', 'founding', expect.any(String))
    );
  });

  it('re-reads after granting, rather than trusting a local flag', async () => {
    render(<CoachRoomsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate 12 months' }));
    // `is_active` is computed by the database from the entitlement; a row that
    // claims Active while the server disagrees is the one lie this screen
    // cannot afford.
    await waitFor(() => expect(listRoomsForAdmin).toHaveBeenCalledTimes(2));
  });

  it('surfaces a refused grant instead of appearing to succeed', async () => {
    grantRoomEntitlement.mockResolvedValue({ ok: false, reason: 'forbidden' });
    render(<CoachRoomsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate 12 months' }));
    expect(await screen.findByText('forbidden')).toBeDefined();
  });

  it('puts rooms needing action above ones that do not', async () => {
    listRoomsForAdmin.mockResolvedValue({
      ok: true,
      rooms: [
        room({
          roomId: 'a',
          handle: 'active_one',
          isActive: true,
          entitlement: { source: 'founding', expiresAt: null },
        }),
        room({ roomId: 'b', handle: 'needs_help' }),
      ],
    });
    render(<CoachRoomsPanel />);
    await screen.findByText('@needs_help');
    const text = document.body.textContent ?? '';
    expect(text.indexOf('@needs_help')).toBeLessThan(text.indexOf('@active_one'));
  });

  it('shows the read error rather than an empty list that looks like no rooms', async () => {
    listRoomsForAdmin.mockResolvedValue({ ok: false, reason: 'forbidden' });
    render(<CoachRoomsPanel />);
    expect(await screen.findByText('forbidden')).toBeDefined();
  });
});
