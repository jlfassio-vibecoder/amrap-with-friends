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
const rotateMock = vi.fn();

const saveIdentityMock = vi.fn();

vi.mock('@/lib/api/squad', () => ({
  fetchMySquad: (...args: unknown[]) => fetchMock(...args),
  searchAthletes: (...args: unknown[]) => searchMock(...args),
  sendSquadInvite: (...args: unknown[]) => sendMock(...args),
  respondSquadInvite: (...args: unknown[]) => respondMock(...args),
  cancelSquadInvite: (...args: unknown[]) => cancelMock(...args),
  removeSquadFriend: (...args: unknown[]) => removeMock(...args),
  rotateSquadInviteCode: (...args: unknown[]) => rotateMock(...args),
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
  useAthleteProfile: () => ({
    profile: null,
    missing: false,
    loading: false,
    error: null,
    saveIdentity: saveIdentityMock,
  }),
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
  rotateMock.mockReset();
  saveIdentityMock.mockReset();
  saveIdentityMock.mockResolvedValue({ error: null });
  fetchMock.mockResolvedValue({ data: squad(), error: null });
  searchMock.mockResolvedValue({ data: [], error: null });
  sendMock.mockResolvedValue({ error: null });
  respondMock.mockResolvedValue({ error: null });
  cancelMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  rotateMock.mockResolvedValue({ data: 'NEWCODE123', error: null });
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

  it('resets the invite link behind a confirmation, and copies the new one', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset link' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Reset link' }));
    expect(rotateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, reset it' }));
    await waitFor(() => expect(rotateMock).toHaveBeenCalledTimes(1));

    // The copy button must hand out the new link, not the retired one.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'COPY INVITE LINK' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: 'COPY INVITE LINK' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('NEWCODE123')
      )
    );
  });

  it('lets the athlete back out of resetting the link', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset link' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Reset link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Reset link' })).toBeTruthy();
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('accepts an incoming invite straight from the search result', async () => {
    searchMock.mockResolvedValue({
      data: [
        {
          userId: 'u9',
          username: 'rico',
          nickname: 'Rico',
          status: 'pending_in',
          requestId: 'req-9',
        },
      ],
      error: null,
    });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Username or email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'rico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(respondMock).toHaveBeenCalledWith('req-9', true));
  });

  it('opens the identity overlay when fetchMySquad requires intake, then reloads', async () => {
    fetchMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Complete your profile before inviting people to your squad.' },
      })
      .mockResolvedValueOnce({ data: squad(), error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(
      screen.queryByText('Complete your profile before inviting people to your squad.')
    ).toBeNull();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(saveIdentityMock).toHaveBeenCalled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/Nobody is on your squad yet/)).toBeTruthy());
  });
});
