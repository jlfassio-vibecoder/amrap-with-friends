import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinSessionPage from './JoinSessionPage';
import {
  SESSION_LOCKED_OR_INVALID,
  SESSION_RALLY_DEPARTED,
} from '@/lib/api/sessions';

const joinSessionMock = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthLoading: false,
  user: null as { id: string; email?: string } | null,
}));

vi.mock('@/lib/api/sessions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/sessions')>(
    '@/lib/api/sessions'
  );
  return {
    ...actual,
    joinSession: (...args: unknown[]) => joinSessionMock(...args),
  };
});

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: authState.isAuthLoading,
    user: authState.user,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseConfigError: () => null,
}));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  joinSessionMock.mockReset();
  authState.isAuthenticated = false;
  authState.isAuthLoading = false;
  authState.user = null;
});

function renderJoin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/join" element={<JoinSessionPage />} />
          <Route path="/session/:sessionId" element={<p>In lobby</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('JoinSessionPage deep link', () => {
  it('hides Session ID and shows temporary callsign for guests', () => {
    renderJoin(`/join?s=${SESSION_ID}`);
    expect(screen.queryByLabelText(/Session ID/i)).toBeNull();
    expect(screen.getByLabelText(/Enter temporary callsign/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Breach lobby/i })).toBeTruthy();
  });

  it('joins as guest with callsign from the breach form', async () => {
    joinSessionMock.mockResolvedValue({
      data: { participantId: 'p1', claimToken: 'c1' },
      error: null,
    });
    renderJoin(`/join?s=${SESSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Enter temporary callsign/i), {
      target: { value: 'Ghost' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Breach lobby/i }));

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        nickname: 'Ghost',
      });
    });
    expect(await screen.findByText('In lobby')).toBeTruthy();
  });

  it('auto-joins authenticated users with email local-part', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'operator@example.com' };
    joinSessionMock.mockResolvedValue({
      data: { participantId: 'p1', claimToken: 'c1' },
      error: null,
    });

    renderJoin(`/join?s=${SESSION_ID}`);

    expect(screen.getByText(/Welcome, operator/i)).toBeTruthy();
    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        nickname: 'operator',
      });
    });
    expect(await screen.findByText('In lobby')).toBeTruthy();
  });

  it('shows LOCKED OR INVALID for a bad s param', () => {
    renderJoin('/join?s=not-a-uuid');
    expect(screen.getByText(SESSION_LOCKED_OR_INVALID)).toBeTruthy();
    expect(screen.queryByLabelText(/Enter temporary callsign/i)).toBeNull();
  });

  it('surfaces departed copy when joinSession reports Session locked', async () => {
    joinSessionMock.mockResolvedValue({
      data: null,
      error: { message: SESSION_RALLY_DEPARTED },
    });
    renderJoin(`/join?s=${SESSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Enter temporary callsign/i), {
      target: { value: 'Late' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Breach lobby/i }));

    expect(await screen.findByText(SESSION_RALLY_DEPARTED)).toBeTruthy();
  });
});
