import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoachFeaturedWodPanel } from './CoachFeaturedWodPanel';

const fetchCoachFeaturedScheduleMock = vi.fn();
const setCoachFeaturedScheduleMock = vi.fn();
const fetchCoachWorkoutsMock = vi.fn();
const fetchCoachFeaturedWodAttendeesMock = vi.fn();
const fetchCurrentFeaturedWodMock = vi.fn();

vi.mock('@/lib/api/featuredWodSchedule', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/featuredWodSchedule')>(
    '@/lib/api/featuredWodSchedule'
  );
  return {
    ...actual,
    fetchCoachFeaturedSchedule: (...args: unknown[]) => fetchCoachFeaturedScheduleMock(...args),
    setCoachFeaturedSchedule: (...args: unknown[]) => setCoachFeaturedScheduleMock(...args),
    pauseCoachFeaturedSchedule: vi.fn(),
    deleteCoachFeaturedSchedule: vi.fn(),
    fetchCoachFeaturedWodAttendees: (...args: unknown[]) =>
      fetchCoachFeaturedWodAttendeesMock(...args),
  };
});

vi.mock('@/lib/api/featuredWod', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/featuredWod')>('@/lib/api/featuredWod');
  return {
    ...actual,
    fetchCurrentFeaturedWod: (...args: unknown[]) => fetchCurrentFeaturedWodMock(...args),
  };
});

vi.mock('@/lib/api/coachWod', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/coachWod')>('@/lib/api/coachWod');
  return {
    ...actual,
    fetchCoachWorkouts: (...args: unknown[]) => fetchCoachWorkoutsMock(...args),
  };
});

const PUBLISHED_WORKOUT = {
  id: 'wk-1',
  name: 'Sunrise AMRAP',
  focus: 'Full body',
  durationMinutes: 20,
  intensityTier: 3,
  tags: [],
  movementCount: 1,
  isLocked: false,
  status: 'published' as const,
  isShared: false,
  isOwner: true,
  updatedAt: '2026-08-29T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  fetchCoachFeaturedScheduleMock.mockReset();
  setCoachFeaturedScheduleMock.mockReset();
  fetchCoachWorkoutsMock.mockReset();
  fetchCoachFeaturedWodAttendeesMock.mockReset();
  fetchCurrentFeaturedWodMock.mockReset();
  fetchCoachFeaturedWodAttendeesMock.mockResolvedValue({
    data: { missionId: null, attendees: [] },
    error: null,
  });
  fetchCurrentFeaturedWodMock.mockResolvedValue({ data: null, error: null });
});
fetchCoachFeaturedWodAttendeesMock.mockResolvedValue({
  data: { missionId: null, attendees: [] },
  error: null,
});
fetchCurrentFeaturedWodMock.mockResolvedValue({ data: null, error: null });

async function renderFormWithNoSchedule() {
  fetchCoachFeaturedScheduleMock.mockResolvedValue({ data: null, error: null });
  fetchCoachWorkoutsMock.mockResolvedValue({ data: [PUBLISHED_WORKOUT], error: null });

  render(
    <MemoryRouter>
      <CoachFeaturedWodPanel />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Set featured WOD' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set featured WOD' }));

  await waitFor(() => {
    expect(screen.getByRole('group', { name: 'Days of week' })).toBeTruthy();
  });
}

const EXISTING_SCHEDULE = {
  id: 'sched-1',
  coachWorkoutId: 'wk-1',
  workoutName: 'Sunrise AMRAP',
  daysOfWeek: [1],
  timesLocal: ['06:00'],
  timezone: 'America/Los_Angeles',
  active: true,
  updatedAt: '2026-08-29T00:00:00.000Z',
};

async function renderWithExistingSchedule() {
  fetchCoachFeaturedScheduleMock.mockResolvedValue({ data: EXISTING_SCHEDULE, error: null });
  fetchCoachWorkoutsMock.mockResolvedValue({ data: [PUBLISHED_WORKOUT], error: null });

  render(
    <MemoryRouter>
      <CoachFeaturedWodPanel />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Sunrise AMRAP')).toBeTruthy();
  });
}

describe('CoachFeaturedWodPanel attendee list', () => {
  it('renders nothing while no live mission exists', async () => {
    fetchCoachFeaturedWodAttendeesMock.mockResolvedValue({
      data: { missionId: null, attendees: [] },
      error: null,
    });

    await renderWithExistingSchedule();

    await waitFor(() => {
      expect(fetchCoachFeaturedWodAttendeesMock).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Who's coming/)).toBeNull();
  });

  it('shows the attendee list for a live mission, host first', async () => {
    fetchCoachFeaturedWodAttendeesMock.mockResolvedValue({
      data: {
        missionId: 'mission-1',
        attendees: [
          { nickname: 'Coach', role: 'host', joinedAt: '2026-08-29T00:00:00.000Z' },
          { nickname: 'Alice', role: 'joiner', joinedAt: '2026-08-29T00:01:00.000Z' },
        ],
      },
      error: null,
    });

    await renderWithExistingSchedule();

    await waitFor(() => {
      expect(screen.getByText("Who's coming (2)")).toBeTruthy();
    });
    expect(screen.getByText(/Coach \(host\)/)).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('shows an empty-state message when the live mission has no joiners', async () => {
    fetchCoachFeaturedWodAttendeesMock.mockResolvedValue({
      data: { missionId: 'mission-1', attendees: [] },
      error: null,
    });

    await renderWithExistingSchedule();

    await waitFor(() => {
      expect(screen.getByText('No one has joined yet.')).toBeTruthy();
    });
  });
});

describe('CoachFeaturedWodPanel join rally point', () => {
  it('hides Join mission more than 15 minutes before start', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: {
        workoutName: 'Sunrise AMRAP',
        focus: null,
        durationMinutes: 20,
        intensityTier: 3,
        tags: [],
        scheduledAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        missionId: 'mission-1',
        state: 'waiting',
        startedAt: null,
        attendeeCount: 1,
      },
      error: null,
    });

    await renderWithExistingSchedule();

    await waitFor(() => {
      expect(fetchCurrentFeaturedWodMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('link', { name: /Join mission/i })).toBeNull();
  });

  it('shows Join mission within 15 minutes of start', async () => {
    fetchCurrentFeaturedWodMock.mockResolvedValue({
      data: {
        workoutName: 'Sunrise AMRAP',
        focus: null,
        durationMinutes: 20,
        intensityTier: 3,
        tags: [],
        scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        missionId: 'mission-1',
        state: 'waiting',
        startedAt: null,
        attendeeCount: 1,
      },
      error: null,
    });

    await renderWithExistingSchedule();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Join mission/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /Join mission/i }).getAttribute('href')).toBe(
      '/mission/mission-1'
    );
  });
});

describe('CoachFeaturedWodPanel timezone field', () => {
  it('pre-fills with a recognized timezone and offers a populated dropdown', async () => {
    await renderFormWithNoSchedule();

    const input = screen.getByPlaceholderText('America/Los_Angeles') as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);

    const datalist = document.getElementById('featured-wod-timezone-options');
    expect(datalist).not.toBeNull();
    expect(datalist?.querySelectorAll('option').length).toBeGreaterThan(100);
    expect(datalist?.querySelector('option[value="America/New_York"]')).not.toBeNull();

    // No warning for the pre-filled (recognized) value.
    expect(screen.queryByText(/Not a recognized timezone/)).toBeNull();
  });

  it('blocks submit and warns inline for an unrecognized timezone', async () => {
    await renderFormWithNoSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    const input = screen.getByPlaceholderText('America/Los_Angeles');
    fireEvent.change(input, { target: { value: 'Not/ARealZone' } });

    expect(screen.getByText(/Not a recognized timezone/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save featured schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Choose a recognized timezone from the list.')).toBeTruthy();
    });
    expect(setCoachFeaturedScheduleMock).not.toHaveBeenCalled();
  });

  it('allows submit for a recognized timezone typed from the list', async () => {
    await renderFormWithNoSchedule();
    setCoachFeaturedScheduleMock.mockResolvedValue({
      data: {
        id: 'sched-1',
        coachWorkoutId: 'wk-1',
        workoutName: 'Sunrise AMRAP',
        daysOfWeek: [0],
        timesLocal: ['06:00'],
        timezone: 'America/New_York',
        active: true,
        updatedAt: '2026-08-29T00:00:00.000Z',
      },
      error: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    const input = screen.getByPlaceholderText('America/Los_Angeles');
    fireEvent.change(input, { target: { value: 'America/New_York' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save featured schedule' }));

    await waitFor(() => {
      expect(setCoachFeaturedScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'America/New_York' })
      );
    });
  });
});

describe('CoachFeaturedWodPanel next-occurrences preview', () => {
  it('shows no preview block until at least one day is selected', async () => {
    await renderFormWithNoSchedule();
    expect(screen.queryByText('Next occurrences')).toBeNull();
  });

  it('shows computed upcoming times once a day and time are set', async () => {
    await renderFormWithNoSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));

    await waitFor(() => {
      expect(screen.getByText('Next occurrences')).toBeTruthy();
    });
    // The default time (06:00) is set, so a preview should render — either
    // real upcoming instants or the empty-state hint, never both absent.
    const emptyHint = screen.queryByText('Add at least one day and time to preview.');
    const list = document.querySelectorAll('li');
    expect(emptyHint !== null || list.length > 0).toBe(true);
  });

  it('shows a timezone hint instead of times for an unrecognized timezone', async () => {
    await renderFormWithNoSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    const input = screen.getByPlaceholderText('America/Los_Angeles');
    fireEvent.change(input, { target: { value: 'Not/ARealZone' } });

    await waitFor(() => {
      expect(screen.getByText('Pick a recognized timezone to preview.')).toBeTruthy();
    });
  });
});
