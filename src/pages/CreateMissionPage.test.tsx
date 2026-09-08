import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import {
  markGuidedIgnitionComplete,
  resetGuidedIgnitionPrefs,
} from '@/lib/onboarding/guidedIgnitionPrefs';
import CreateMissionPage from './CreateMissionPage';

const createRallyPointMock = vi.fn();
const createMissionMock = vi.fn();
const setMissionChainMock = vi.fn();
const navigateMock = vi.fn();
const saveIdentityMock = vi.fn();

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  profile: {
    username: 'ghost',
    nickname: 'Ghost',
    heightCm: null,
    weightKg: null,
    birthYear: null,
    biologicalSex: null,
    perceivedClassification: null,
  } as {
    username: string;
    nickname: string;
    heightCm: number | null;
    weightKg: number | null;
    birthYear: number | null;
    biologicalSex: null;
    perceivedClassification: null;
  } | null,
  missing: false,
  loading: false,
}));

vi.mock('@/lib/api/rallyPoint', () => ({
  createRallyPointMission: (...args: unknown[]) => createRallyPointMock(...args),
}));
vi.mock('@/lib/api/missionChain', () => ({
  setMissionChain: (...args: unknown[]) => setMissionChainMock(...args),
}));
vi.mock('@/lib/api/missions', () => ({
  fetchHostActiveMissionCount: () => Promise.resolve({ data: 0, error: null }),
  createMission: (...args: unknown[]) => createMissionMock(...args),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseConfigError: () => null,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(), trackBeacon: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: false,
    user: authState.isAuthenticated ? { id: 'u1' } : null,
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => ({
    profile: authState.isAuthenticated ? authState.profile : null,
    missing: authState.isAuthenticated ? authState.missing : false,
    loading: authState.loading,
    error: null,
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: false,
    save: vi.fn(),
    saveIdentity: saveIdentityMock,
  }),
}));
vi.mock('@/hooks/useHudTelemetry', () => ({
  useHudTelemetry: () => ({
    telemetry: null,
    error: null,
    loading: false,
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: false,
  }),
}));
vi.mock('@/hooks/useSmartRecovery', () => ({
  useSmartRecovery: () => ({
    enabled: false,
    setEnabled: vi.fn(),
    locks: new Set(),
    loading: false,
    error: null,
    coachWorkouts: null,
  }),
}));
vi.mock('@/components/home/FeaturedWodCard', () => ({
  FeaturedWodCard: () => null,
}));
vi.mock('@/components/createMission/WorkoutTemplatePicker', () => ({
  WorkoutTemplatePicker: ({
    onTemplateSelect,
    onDurationChange,
  }: {
    onTemplateSelect: (template: (typeof WORKOUT_TEMPLATES)[number]) => void;
    onDurationChange: (domain: 5 | 10 | 15 | 20) => void;
  }) => (
    <>
      <button type="button" onClick={() => onTemplateSelect(WORKOUT_TEMPLATES[0]!)}>
        Pick workout
      </button>
      <button type="button" onClick={() => onDurationChange(20)}>
        Pick Long domain
      </button>
      <button type="button" onClick={() => onDurationChange(10)}>
        Pick Short domain
      </button>
    </>
  ),
}));
vi.mock('@/components/createMission/CoachWodPicker', () => ({
  CoachWodPicker: () => null,
}));
vi.mock('@/components/mission/SendWorkoutToSquad', () => ({
  SendWorkoutToSquad: () => null,
}));
vi.mock('@/components/AuthModal', () => ({
  AuthModal: () => <div>Save & Launch</div>,
}));
vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: () => false,
  isPasswordResetEnabled: () => false,
  isGoogleAuthEnabled: () => false,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <ThemeProvider>
        <CreateMissionPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  resetGuidedIgnitionPrefs();
});

beforeEach(() => {
  createRallyPointMock.mockReset();
  createMissionMock.mockReset();
  setMissionChainMock.mockReset();
  navigateMock.mockReset();
  saveIdentityMock.mockReset();
  saveIdentityMock.mockResolvedValue({ error: null });
  createRallyPointMock.mockResolvedValue({
    data: {
      missionId: 'm1',
      rallyPointId: 'rp1',
      rallyPointMemberId: 'rpm1',
      hostToken: 'host',
      participantId: 'p1',
      claimToken: 'claim',
    },
    error: null,
  });
  createMissionMock.mockResolvedValue({ data: { missionId: 'm1' }, error: null });
  setMissionChainMock.mockResolvedValue({ data: { count: 2 }, error: null });
  authState.isAuthenticated = true;
  authState.profile = {
    username: 'ghost',
    nickname: 'Ghost',
    heightCm: null,
    weightKg: null,
    birthYear: null,
    biologicalSex: null,
    perceivedClassification: null,
  };
  authState.missing = false;
  authState.loading = false;
});

describe('CreateMissionPage Launch identity', () => {
  beforeEach(() => {
    markGuidedIgnitionComplete();
  });

  it('ignites immediately when identity is complete', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    expect(setMissionChainMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Your name' })).toBeNull();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('persists a stamped chain when launching two or more missions', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to chain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to chain' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setMissionChainMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rallyPointId: 'rp1',
          items: expect.arrayContaining([
            expect.objectContaining({
              startedMissionId: 'm1',
            }),
          ]),
        })
      );
    });
    const chainArg = setMissionChainMock.mock.calls[0]?.[0] as {
      items: { startedMissionId: string | null }[];
    };
    expect(chainArg.items).toHaveLength(2);
    expect(chainArg.items[0]?.startedMissionId).toBe('m1');
    expect(chainArg.items[1]?.startedMissionId).toBeNull();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('opens the identity overlay for a signed-in incomplete profile', async () => {
    authState.profile = null;
    authState.missing = true;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Finish your profile' })).toBeNull();
    expect(createRallyPointMock).not.toHaveBeenCalled();
  });

  it('accepts a name and ignites without a second Launch', async () => {
    authState.profile = null;
    authState.missing = true;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
        'disabled',
        false
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    await waitFor(() => {
      expect(saveIdentityMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('creates as a guest when unsigned with a nickname', async () => {
    authState.isAuthenticated = false;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    await waitFor(() => {
      expect(createMissionMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Save & Launch')).toBeNull();
    expect(createRallyPointMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('opens Save & Launch auth when unsigned and scheduling', async () => {
    authState.isAuthenticated = false;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule rally point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule rally point' }));

    expect(screen.getByText('Save & Launch')).toBeTruthy();
    expect(createMissionMock).not.toHaveBeenCalled();
    expect(createRallyPointMock).not.toHaveBeenCalled();
  });
});

describe('CreateMissionPage Guided Ignition', () => {
  beforeEach(() => {
    resetGuidedIgnitionPrefs();
  });

  it('launches first-contact and navigates to the rally point', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Set my baseline' }));

    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    expect(createRallyPointMock.mock.calls[0]?.[0]).toMatchObject({
      templateId: 'first-contact',
      nickname: 'Ghost',
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('opens identity overlay when profile is incomplete, then navigates after accept', async () => {
    authState.profile = null;
    authState.missing = true;
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Set my baseline' }));

    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(createRallyPointMock).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
        'disabled',
        false
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    await waitFor(() => {
      expect(saveIdentityMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    expect(createRallyPointMock.mock.calls[0]?.[0]).toMatchObject({
      templateId: 'first-contact',
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('guest-creates without Save & Launch when unsigned', async () => {
    authState.isAuthenticated = false;
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Set my baseline' }));

    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(screen.queryByText('Save & Launch')).toBeNull();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept & Launch' })).toHaveProperty(
        'disabled',
        false
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept & Launch' }));

    await waitFor(() => {
      expect(createMissionMock).toHaveBeenCalled();
    });
    expect(saveIdentityMock).not.toHaveBeenCalled();
    expect(createRallyPointMock).not.toHaveBeenCalled();
    expect(createMissionMock.mock.calls[0]?.[0]).toMatchObject({
      templateId: 'first-contact',
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('skip closes the overlay without planning a mission', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Skip and browse/ }));

    expect(screen.queryByRole('dialog', { name: /Determine Your Baseline/i })).toBeNull();
    expect(createRallyPointMock).not.toHaveBeenCalled();
    expect(createMissionMock).not.toHaveBeenCalled();
  });
});

describe('CreateMissionPage time cap', () => {
  beforeEach(() => {
    markGuidedIgnitionComplete();
  });

  function capText(): string {
    return screen.getByText(/Time cap/i).parentElement?.textContent ?? '';
  }

  it("defaults the clock to the domain's canonical minute", () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick Long domain' }));

    expect(capText()).toContain('20 min');
    // Secondary by default: the minute chips are not on screen until asked for.
    expect(screen.queryByRole('group', { name: 'Time cap' })).toBeNull();
  });

  it('resets the clock when the domain changes, so an out-of-range cap cannot survive', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick Long domain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }));
    fireEvent.click(screen.getByRole('button', { name: '25 min' }));
    expect(capText()).toContain('25 min');

    fireEvent.click(screen.getByRole('button', { name: 'Pick Short domain' }));

    // 25 is not a legal Short cap; the clock goes back to the canonical minute
    // rather than clamping to 10 and leaving the host wondering what happened.
    expect(capText()).toContain('10 min');
  });

  it('takes the clock from a selected workout, and lets it be moved inside that domain', () => {
    renderPage();
    // The Piston is a 5-minute workout.
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    expect(capText()).toContain('5 min');

    fireEvent.click(screen.getByRole('button', { name: 'Change it' }));
    fireEvent.click(screen.getByRole('button', { name: '3 min' }));

    expect(capText()).toContain('3 min');
    expect(screen.getByText(/no ghost to race at 3 min/)).toBeTruthy();
  });

  it('creates the mission on the chosen cap, not the canonical minute', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }));
    fireEvent.click(screen.getByRole('button', { name: '4 min' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    await waitFor(() => {
      expect(createRallyPointMock).toHaveBeenCalled();
    });
    expect(createRallyPointMock.mock.calls[0]![0]).toMatchObject({ durationMinutes: 4 });
  });
});
