import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { HostScheduledSessionsPanel } from './HostScheduledSessionsPanel';

const fetchHostScheduledSessionsMock = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthLoading: false,
  user: null as { id: string; email?: string } | null,
  session: null as { access_token: string } | null,
}));

vi.mock('@/lib/api/hostScheduledSessions', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/api/hostScheduledSessions')
  >('@/lib/api/hostScheduledSessions');
  return {
    ...actual,
    fetchHostScheduledSessions: (...args: unknown[]) =>
      fetchHostScheduledSessionsMock(...args),
  };
});

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: authState.isAuthLoading,
    user: authState.user,
    session: authState.session,
  }),
}));

vi.mock('@/components/AuthModal', () => ({
  AuthModal: ({ onClose }: { onClose: () => void }) => (
    <div>
      <p>Auth modal</p>
      <button type="button" onClick={onClose}>
        Close auth
      </button>
    </div>
  ),
}));

vi.mock('@/components/session/EditRallyScheduleForm', () => ({
  EditRallyScheduleForm: ({
    onCancel,
    onSaved,
  }: {
    onCancel?: () => void;
    onSaved?: (scheduledAt: string) => void;
  }) => (
    <div>
      <p>Edit rally form</p>
      <button type="button" onClick={() => onSaved?.('2026-08-26T06:00:00.000Z')}>
        Mock save
      </button>
      {onCancel ? (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  fetchHostScheduledSessionsMock.mockReset();
  authState.isAuthenticated = false;
  authState.isAuthLoading = false;
  authState.user = null;
  authState.session = null;
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <HostScheduledSessionsPanel />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('HostScheduledSessionsPanel', () => {
  it('prompts signed-out users to sign in', () => {
    renderPanel();
    expect(screen.getByText(/Sign in to see your scheduled sessions/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Auth modal')).toBeTruthy();
  });

  it('lists scheduled sessions for authenticated hosts', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'host@example.com' };
    authState.session = { access_token: 'test-access-token' };
    fetchHostScheduledSessionsMock.mockResolvedValue({
      data: [
        {
          sessionId: '22222222-2222-4222-8222-222222222222',
          scheduledAt: '2026-08-25T23:30:00.000Z',
          createdAt: '2026-08-25T12:00:00.000Z',
          durationMinutes: 5,
          workout: [{ name: 'Burpees', target: 20, unit: 'reps' }],
          state: 'waiting',
        },
      ],
      error: null,
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Burpees')).toBeTruthy();
    });
    expect(
      screen.getByRole('link', { name: 'Enter staging area' }).getAttribute('href')
    ).toBe('/session/22222222-2222-4222-8222-222222222222');
    expect(screen.getByRole('link', { name: 'All my sessions' }).getAttribute('href')).toBe(
      '/my-sessions'
    );
  });

  it('opens edit form when Edit time is clicked', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'host@example.com' };
    authState.session = { access_token: 'test-access-token' };
    fetchHostScheduledSessionsMock.mockResolvedValue({
      data: [
        {
          sessionId: '22222222-2222-4222-8222-222222222222',
          scheduledAt: '2026-08-25T23:30:00.000Z',
          createdAt: '2026-08-25T12:00:00.000Z',
          durationMinutes: 5,
          workout: [{ name: 'Burpees', target: 20, unit: 'reps' }],
          state: 'waiting',
        },
      ],
      error: null,
    });

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit time' }));
    expect(screen.getByText('Edit rally form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Edit rally form')).toBeNull();
  });

  it('shows empty state when there are no scheduled sessions', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'host@example.com' };
    authState.session = { access_token: 'test-access-token' };
    fetchHostScheduledSessionsMock.mockResolvedValue({
      data: [],
      error: null,
    });

    renderPanel();

    expect(
      await screen.findByText(/No scheduled sessions. Create one and choose Schedule staging/i)
    ).toBeTruthy();
  });
});
