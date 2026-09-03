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

const createMock = vi.fn();
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
  createRallyPointMission: (...args: unknown[]) => createMock(...args),
}));
vi.mock('@/lib/api/missions', () => ({
  fetchHostActiveMissionCount: () => Promise.resolve({ data: 0, error: null }),
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
    profile: authState.profile,
    missing: authState.missing,
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
  }: {
    onTemplateSelect: (template: (typeof WORKOUT_TEMPLATES)[number]) => void;
  }) => (
    <button type="button" onClick={() => onTemplateSelect(WORKOUT_TEMPLATES[0]!)}>
      Pick workout
    </button>
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
  createMock.mockReset();
  navigateMock.mockReset();
  saveIdentityMock.mockReset();
  saveIdentityMock.mockResolvedValue({ error: null });
  createMock.mockResolvedValue({ data: { missionId: 'm1' }, error: null });
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
      expect(createMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'Your name' })).toBeNull();
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
    expect(createMock).not.toHaveBeenCalled();
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
      expect(createMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('opens Save & Launch auth when unsigned', async () => {
    authState.isAuthenticated = false;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Pick workout' }));
    fireEvent.change(screen.getByPlaceholderText('Host nickname'), {
      target: { value: 'Morning Grind' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));

    expect(screen.getByText('Save & Launch')).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
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
      expect(createMock).toHaveBeenCalled();
    });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
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
    expect(createMock).not.toHaveBeenCalled();

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
      expect(createMock).toHaveBeenCalled();
    });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      templateId: 'first-contact',
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/mission/m1');
    });
  });

  it('opens Save & Launch auth when unsigned and does not create yet', () => {
    authState.isAuthenticated = false;
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Set my baseline' }));

    expect(screen.getByText('Save & Launch')).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('skip closes the overlay without creating a mission', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Skip and browse/ }));

    expect(screen.queryByRole('dialog', { name: /Determine Your Baseline/i })).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });
});
