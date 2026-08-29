import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoachFeaturedWodPanel } from './CoachFeaturedWodPanel';

const fetchCoachFeaturedScheduleMock = vi.fn();
const setCoachFeaturedScheduleMock = vi.fn();
const fetchCoachWorkoutsMock = vi.fn();

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
});

async function renderFormWithNoSchedule() {
  fetchCoachFeaturedScheduleMock.mockResolvedValue({ data: null, error: null });
  fetchCoachWorkoutsMock.mockResolvedValue({ data: [PUBLISHED_WORKOUT], error: null });

  render(<CoachFeaturedWodPanel />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Set featured WOD' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set featured WOD' }));

  await waitFor(() => {
    expect(screen.getByRole('group', { name: 'Days of week' })).toBeTruthy();
  });
}

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
