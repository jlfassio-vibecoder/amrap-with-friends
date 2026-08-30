import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import SquadPage from './SquadPage';

const fetchMock = vi.fn();
const searchMock = vi.fn();
const sendMock = vi.fn();
const respondMock = vi.fn();
const cancelMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/lib/api/squad', () => ({
  fetchMySquad: (...args: unknown[]) => fetchMock(...args),
  searchAthletes: (...args: unknown[]) => searchMock(...args),
  sendSquadInvite: (...args: unknown[]) => sendMock(...args),
  respondSquadInvite: (...args: unknown[]) => respondMock(...args),
  cancelSquadInvite: (...args: unknown[]) => cancelMock(...args),
  removeSquadFriend: (...args: unknown[]) => removeMock(...args),
}));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: 'u1' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({ profile: null, missing: false, loading: false, error: null }),
}));

function squad(overrides = {}) {
  return {
    inviteCode: 'ABC123XYZ0',
    friendLimit: 50,
    friends: [] as { userId: string; username: string; nickname: string }[],
    incoming: [] as { userId: string; username: string; nickname: string; requestId: string }[],
    outgoing: [] as { userId: string; username: string; nickname: string; requestId: string }[],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/squad']}>
      <ThemeProvider>
        <SquadPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  fetchMock.mockReset();
  searchMock.mockReset();
  sendMock.mockReset();
  respondMock.mockReset();
  cancelMock.mockReset();
  removeMock.mockReset();
  fetchMock.mockResolvedValue({ data: squad(), error: null });
  searchMock.mockResolvedValue({ data: [], error: null });
  sendMock.mockResolvedValue({ error: null });
  respondMock.mockResolvedValue({ error: null });
  cancelMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('SquadPage', () => {
  it('shows empty copy when nobody is on the squad yet', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Nobody is on your squad yet/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'COPY INVITE LINK' })).toBeTruthy();
  });

  it('searches and sends an invite', async () => {
    searchMock.mockResolvedValue({
      data: [{ userId: 'u2', username: 'jules', nickname: 'Jules', status: 'none' }],
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Username or email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Username or email'), {
      target: { value: 'jules' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith('jules'));
    await waitFor(() => expect(screen.getByText('Jules')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('u2'));
  });

  it('lets the recipient accept or decline', async () => {
    fetchMock.mockResolvedValue({
      data: squad({
        incoming: [{ userId: 'u3', username: 'rico', nickname: 'Rico', requestId: 'r1' }],
      }),
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Rico')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(respondMock).toHaveBeenCalledWith('r1', true));
  });

  it('lists squad members and can remove one', async () => {
    fetchMock.mockResolvedValue({
      data: squad({
        friends: [{ userId: 'u2', username: 'jules', nickname: 'Jules' }],
      }),
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jules')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('u2'));
  });
});
