import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArmedRallyPointControls } from './ArmedRallyPointControls';

const MISSION_ID = '11111111-1111-4111-8111-111111111111';

const cancelRallyPointCountdownMock = vi.fn();

vi.mock('@/lib/api/missionSync', () => ({
  cancelRallyPointCountdown: (...args: unknown[]) => cancelRallyPointCountdownMock(...args),
}));

vi.mock('@/lib/missionIdentity', () => ({
  getStoredHostToken: () => 'host-token',
}));

afterEach(() => {
  cleanup();
  cancelRallyPointCountdownMock.mockReset();
});

describe('ArmedRallyPointControls', () => {
  it('shows Override: start now while the countdown is ticking', () => {
    const onStart = vi.fn();
    render(
      <ArmedRallyPointControls
        missionId={MISSION_ID}
        ticking
        overtimeSec={null}
        onStart={onStart}
      />
    );

    expect(screen.getByRole('button', { name: 'Override: start now' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByLabelText('Time past countdown end')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Override: start now' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('shows Start with +elapsed after T-0 and does not auto-start', () => {
    const onStart = vi.fn();
    render(
      <ArmedRallyPointControls
        missionId={MISSION_ID}
        ticking={false}
        overtimeSec={5}
        onStart={onStart}
      />
    );

    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByLabelText('Time past countdown end').textContent).toBe('+00:05');
    expect(screen.queryByRole('button', { name: 'Override: start now' })).toBeNull();
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('hides +elapsed when overtimeSec is null after T-0', () => {
    render(
      <ArmedRallyPointControls
        missionId={MISSION_ID}
        ticking={false}
        overtimeSec={null}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.queryByLabelText('Time past countdown end')).toBeNull();
  });

  it('shows +00:00 when overtime is zero', () => {
    render(
      <ArmedRallyPointControls
        missionId={MISSION_ID}
        ticking={false}
        overtimeSec={0}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Time past countdown end').textContent).toBe('+00:00');
  });
});
