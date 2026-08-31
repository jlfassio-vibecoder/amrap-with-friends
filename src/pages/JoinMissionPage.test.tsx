import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinMissionPage from './JoinMissionPage';
import { MISSION_LOCKED_OR_INVALID, MISSION_RALLY_DEPARTED } from '@/lib/api/missions';

const joinMissionMock = vi.fn();
const joinRallyPointMock = vi.fn();
const resumeMissionIdentityMock = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthLoading: false,
  user: null as { id: string; email?: string } | null,
}));

vi.mock('@/lib/api/missions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/missions')>('@/lib/api/missions');
  return {
    ...actual,
    joinMission: (...args: unknown[]) => joinMissionMock(...args),
  };
});

vi.mock('@/lib/api/rallyPoint', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/rallyPoint')>('@/lib/api/rallyPoint');
  return {
    ...actual,
    joinRallyPoint: (...args: unknown[]) => joinRallyPointMock(...args),
  };
});

vi.mock('@/lib/api/resumeMissionIdentity', () => ({
  resumeMissionIdentity: (...args: unknown[]) => resumeMissionIdentityMock(...args),
}));

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

vi.mock('@/lib/api/hostScheduledMissions', () => ({
  fetchHostScheduledMissions: vi.fn().mockResolvedValue({ data: [], error: null }),
  formatHostScheduledMissionWorkout: (workout: { name: string }[]) => workout[0]?.name ?? 'Workout',
  formatHostScheduledMissionRallyTime: () => 'Rally time',
  formatHostScheduledMissionState: (state: string) => state,
}));

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

afterEach(() => {
  cleanup();
  joinMissionMock.mockReset();
  joinRallyPointMock.mockReset();
  resumeMissionIdentityMock.mockReset();
  authState.isAuthenticated = false;
  authState.isAuthLoading = false;
  authState.user = null;
});

function renderJoin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/join" element={<JoinMissionPage />} />
          <Route path="/mission/:missionId" element={<p>At the rally point</p>} />
          <Route path="/rally-point/:rallyPointId" element={<p>At the rally point</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('JoinMissionPage deep link', () => {
  it('hides Mission ID and shows the name field for guests', () => {
    renderJoin(`/join?m=${MISSION_ID}`);
    expect(screen.queryByLabelText(/Mission ID/i)).toBeNull();
    expect(screen.getByLabelText(/Your name/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Join mission/i })).toBeTruthy();
  });

  it('joins as guest with a name from the join form', async () => {
    joinMissionMock.mockResolvedValue({
      data: { participantId: 'p1', claimToken: 'c1' },
      error: null,
    });
    renderJoin(`/join?m=${MISSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Ghost' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join mission/i }));

    await waitFor(() => {
      expect(joinMissionMock).toHaveBeenCalledWith({
        missionId: MISSION_ID,
        nickname: 'Ghost',
      });
    });
    expect(await screen.findByText('At the rally point')).toBeTruthy();
  });

  it('auto-joins authenticated users with email local-part', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'operator@example.com' };
    resumeMissionIdentityMock.mockResolvedValue({
      data: null,
      missing: true,
      error: null,
    });
    joinMissionMock.mockResolvedValue({
      data: {
        participantId: 'p1',
        claimToken: 'c1',
        hostToken: null,
        nickname: 'operator',
        role: 'joiner',
      },
      error: null,
    });

    renderJoin(`/join?m=${MISSION_ID}`);

    expect(screen.getByText(/Welcome, operator/i)).toBeTruthy();
    await waitFor(() => {
      expect(resumeMissionIdentityMock).toHaveBeenCalledWith(MISSION_ID);
      expect(joinMissionMock).toHaveBeenCalledWith({
        missionId: MISSION_ID,
        nickname: 'operator',
      });
    });
    expect(await screen.findByText('At the rally point')).toBeTruthy();
  });

  it('reclaims host via resume before join for authenticated users', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'coach@example.com' };
    resumeMissionIdentityMock.mockResolvedValue({
      data: {
        participantId: 'host-1',
        nickname: 'Coach',
        role: 'host',
        hostToken: 'host-secret',
      },
      missing: false,
      error: null,
    });

    renderJoin(`/join?m=${MISSION_ID}`);

    await waitFor(() => {
      expect(resumeMissionIdentityMock).toHaveBeenCalledWith(MISSION_ID);
    });
    expect(joinMissionMock).not.toHaveBeenCalled();
    expect(await screen.findByText('At the rally point')).toBeTruthy();
  });

  it('shows LOCKED OR INVALID for a bad s param', () => {
    renderJoin('/join?m=not-a-uuid');
    expect(screen.getByText(MISSION_LOCKED_OR_INVALID)).toBeTruthy();
    expect(screen.queryByLabelText(/Your name/i)).toBeNull();
  });

  it('surfaces departed copy when joinMission reports Mission locked', async () => {
    joinMissionMock.mockResolvedValue({
      data: null,
      error: { message: MISSION_RALLY_DEPARTED },
    });
    renderJoin(`/join?m=${MISSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Late' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join mission/i }));

    expect(await screen.findByText(MISSION_RALLY_DEPARTED)).toBeTruthy();
  });

  it('routes ?r= to the rally point when the active mission is finished', async () => {
    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_ID,
        missionState: 'finished',
        participantId: 'p1',
        claimToken: null,
        hostToken: null,
      },
      error: null,
    });
    renderJoin(`/join?r=${RALLY_POINT_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Jules' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join mission/i }));

    await waitFor(() => {
      expect(joinRallyPointMock).toHaveBeenCalledWith({
        rallyPointId: RALLY_POINT_ID,
        nickname: 'Jules',
      });
    });
    expect(await screen.findByText('At the rally point')).toBeTruthy();
  });

  it('routes ?r= to the mission when the active mission is live', async () => {
    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_ID,
        missionState: 'waiting',
        participantId: 'p1',
        claimToken: 'c1',
        hostToken: null,
      },
      error: null,
    });
    renderJoin(`/join?r=${RALLY_POINT_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Jules' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join mission/i }));

    expect(await screen.findByText('At the rally point')).toBeTruthy();
  });
});
