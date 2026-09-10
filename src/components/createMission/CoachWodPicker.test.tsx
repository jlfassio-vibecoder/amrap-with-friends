import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublishedCoachWorkout } from '@/lib/api/coachWod';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';
import { coachWorkoutLockId } from '@/lib/smartRecovery/deriveCoachWorkoutPatterns';

const fetchPublishedCoachWorkouts = vi.fn();

vi.mock('@/lib/api/coachWod', () => ({
  fetchPublishedCoachWorkouts: (...args: unknown[]) => fetchPublishedCoachWorkouts(...args),
}));

import { CoachWodPicker } from './CoachWodPicker';

afterEach(() => {
  cleanup();
  fetchPublishedCoachWorkouts.mockReset();
});

const workout: PublishedCoachWorkout = {
  id: 'coach-workout-1',
  name: 'Coach Crucible',
  focus: 'Go hard',
  durationMinutes: 10,
  intensityTier: 5,
  tags: ['test'],
  notes: null,
  movements: [{ name: 'Burpees', exercise: null }],
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const futureLock: TemplateRecoveryLock = {
  templateId: coachWorkoutLockId('coach-workout-1'),
  reason: 'severe-intensity',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
};

function renderPicker(overrides: Partial<Parameters<typeof CoachWodPicker>[0]> = {}) {
  return render(
    <CoachWodPicker
      selectedWorkoutId={null}
      smartRecoveryEnabled
      onSmartRecoveryEnabledChange={() => undefined}
      recoveryLocks={new Map()}
      smartRecoveryActive={false}
      isAuthenticated
      coachWorkouts={[workout]}
      onSelect={() => undefined}
      {...overrides}
    />
  );
}

describe('CoachWodPicker', () => {
  it('does not call onSelect when a coach workout is locked', async () => {
    const onSelect = vi.fn();

    renderPicker({
      smartRecoveryActive: true,
      recoveryLocks: new Map([[coachWorkoutLockId(workout.id), futureLock]]),
      onSelect,
    });

    expect(await screen.findByText('Coach Crucible')).toBeTruthy();
    fireEvent.click(screen.getByText('Coach Crucible'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect when a coach workout is unlocked', async () => {
    const onSelect = vi.fn();

    renderPicker({ onSelect });

    expect(await screen.findByText('Coach Crucible')).toBeTruthy();
    fireEvent.click(screen.getByText('Coach Crucible'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(workout);
  });

  it('skips internal fetch when coach workouts are provided', async () => {
    renderPicker();

    expect(await screen.findByText('Coach Crucible')).toBeTruthy();
    expect(fetchPublishedCoachWorkouts).not.toHaveBeenCalled();
  });
});
