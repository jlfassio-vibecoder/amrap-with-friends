import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import HUDPage from './HUDPage';
import type { HUDTelemetryPayload } from '@/lib/hud/types';

const hudTelemetryState = vi.hoisted(() => ({
  telemetry: null as HUDTelemetryPayload | null,
  error: null as string | null,
  loading: false,
  isAuthenticated: true,
  isAuthLoading: false,
}));

const athleteProfileState = vi.hoisted(() => ({
  profile: {
    birthYear: 1992,
    biologicalSex: 'M' as const,
    perceivedClassification: 'operator' as const,
    heightCm: 180,
    weightKg: 82,
  },
  loading: false,
}));

const physicalActivityState = vi.hoisted(() => ({
  entries: [],
  error: null as string | null,
  loading: false,
  submitting: false,
  isAuthenticated: true,
  isAuthLoading: false,
  logEntry: vi.fn(),
  removeEntry: vi.fn(),
}));

const benchmarkProgressState = vi.hoisted(() => ({
  benchmarks: [],
  missions: [],
  campaignSlots: [],
  loading: false,
}));

vi.mock('@/hooks/useHudTelemetry', () => ({
  useHudTelemetry: () => hudTelemetryState,
}));

vi.mock('@/hooks/useAthleteProfile', () => ({
  useAthleteProfile: () => athleteProfileState,
}));

vi.mock('@/hooks/usePhysicalActivityLog', () => ({
  usePhysicalActivityLog: () => physicalActivityState,
}));

vi.mock('@/hooks/useBenchmarkProgress', () => ({
  useBenchmarkProgress: () => benchmarkProgressState,
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: hudTelemetryState.isAuthenticated,
    isAuthLoading: hudTelemetryState.isAuthLoading,
    user: hudTelemetryState.isAuthenticated ? { id: 'user-1', email: 'hud@example.com' } : null,
    signOut: vi.fn(),
  }),
}));

function buildTelemetry(): HUDTelemetryPayload {
  const weeks = Array.from({ length: 12 }, (_, index) => ({
    weekStart: new Date(2026, 7, 3 + index * 7).toISOString(),
    minutes: index === 11 ? 80 : index === 10 ? 60 : 0,
    compliant: index >= 10,
    missionCount: index === 11 ? 1 : index === 10 ? 1 : 0,
    score: index === 11 ? 240 : index === 10 ? 180 : 0,
    pviAverage: index >= 10 ? 6.4 : null,
    missions:
      index >= 10
        ? [
            {
              missionId: `mission-${index}`,
              pvi: 6.4,
              durationMinutes: 20,
              templateId: null,
              lockedAt: '2026-09-08T17:00:00.000Z',
              finalScore: index === 11 ? 240 : 180,
            },
          ]
        : [],
  }));

  return {
    weekMinutes: 80,
    weekPviAverage: 6.4,
    weekPviMissions: [
      {
        missionId: 'mission-11',
        pvi: 6.4,
        durationMinutes: 20,
        templateId: null,
        lockedAt: '2026-09-08T17:00:00.000Z',
      },
    ],
    weekEndsAt: '2026-09-14T07:00:00.000Z',
    lastLockedAt: '2026-09-08T17:00:00.000Z',
    attrition: Array.from({ length: 12 }, (_, index) => index >= 10),
    weeks,
    domainMinutes30d: { 5: 20, 10: 40, 15: 0, 20: 20, other: 0, activeRecovery: 10 },
    classification: {
      current: 'civilian',
      previous: 'unclassified',
      progress: {
        weekMinutes: 80,
        intensity3PlusCount: 1,
        intensity4PlusCount: 0,
        marathon20Count: 1,
      },
    },
    activity7d: {
      missionCount: 2,
      minutes: 30,
      avgIntensity: 3,
    },
    overtraining: {
      acuteLoad7d: 100,
      chronicWeeklyLoad28d: 100,
      consecutiveHighIntensityDays: 1,
      acuteMinutes7d: 30,
      chronicWeeklyMinutes28d: 45,
      observedDays: 28,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <HUDPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.assign(hudTelemetryState, {
    telemetry: buildTelemetry(),
    error: null,
    loading: false,
    isAuthenticated: true,
    isAuthLoading: false,
  });
  Object.assign(athleteProfileState, {
    profile: {
      birthYear: 1992,
      biologicalSex: 'M',
      perceivedClassification: 'operator',
      heightCm: 180,
      weightKg: 82,
    },
    loading: false,
  });
  Object.assign(physicalActivityState, {
    entries: [],
    error: null,
    loading: false,
    submitting: false,
    isAuthenticated: true,
    isAuthLoading: false,
    logEntry: vi.fn(),
    removeEntry: vi.fn(),
  });
  Object.assign(benchmarkProgressState, {
    benchmarks: [],
    missions: [],
    campaignSlots: [],
    loading: false,
  });
});

afterEach(() => {
  cleanup();
});

describe('HUDPage tabs', () => {
  it('keeps Classification visible and defaults to Mission Health', () => {
    renderPage();

    expect(screen.getByText('Classification')).toBeTruthy();
    expect(screen.getByTestId('classification-checklist')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Mission Health' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Physical Activity' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Physical activity' })).toBeNull();
  });

  it('switches tabs and clears the selected week detail when leaving history', () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Week History' }));
    expect(screen.getByLabelText('Week detail')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Domains' }));
    expect(screen.queryByLabelText('Week detail')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Week History' }));
    // Re-entering re-seeds the current week — detail stays open by default.
    expect(screen.getByLabelText('Week detail')).toBeTruthy();
  });

  it('opens Week History with the current week already inspected', () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Week History' }));

    expect(screen.getByLabelText('Week history trend')).toBeTruthy();
    expect(screen.getByLabelText('Week detail')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByTestId('score-trend-selected-band')).toBeTruthy();
  });

  it('lets Attrition switch which week detail is open', () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Week History' }));
    // Second cell from the left is the prior week (data index 10) in the fixture.
    fireEvent.click(screen.getAllByRole('button', { name: /Week of .*1 mission$/ })[1]!);

    expect(screen.getByLabelText('Week detail')).toBeTruthy();
    expect(screen.getByText('Week of')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This week' })).toBeTruthy();
  });

  it('shows tabbed fallback copy when telemetry is unavailable', () => {
    Object.assign(hudTelemetryState, {
      telemetry: null,
      error: 'Something went wrong.',
      loading: false,
    });

    renderPage();

    expect(screen.getByRole('tablist', { name: 'HUD sections' })).toBeTruthy();
    expect(
      screen.getByText('Mission health will appear here once your HUD telemetry loads.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Benchmarks' }));
    expect(screen.getByText('No active benchmarks yet.')).toBeTruthy();
  });
});
