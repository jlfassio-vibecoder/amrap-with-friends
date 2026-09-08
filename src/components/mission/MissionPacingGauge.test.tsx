import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionPacingGauge } from '@/components/mission/MissionPacingGauge';
import { shouldHandleLogRoundHotkey } from '@/lib/mission/logRoundHotkey';
import { resetPacingGaugePrefs } from '@/lib/pacing/pacingGaugePrefs';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  resetPacingGaugePrefs();
});

function renderAt(phase: string, overrides: Partial<Parameters<typeof MissionPacingGauge>[0]> = {}) {
  return render(
    <MissionPacingGauge
      phase={phase}
      roundSplitsSec={[45]}
      elapsedSec={90}
      isPaused={false}
      isPractice={false}
      {...overrides}
    />
  );
}

describe('the gauge cannot disable the Log round hotkey', () => {
  it('renders no focusable control at all during the mission', () => {
    // This is the whole reason the toggle moved. isTypingTarget treats any
    // focused INPUT as typing, so a checkbox rendered during work is one tap
    // away from killing Space — no round, no round-log sound — for the rest of
    // the mission.
    const { container } = renderAt('work');
    expect(container.querySelectorAll('input, select, textarea, button')).toHaveLength(0);
  });

  it('leaves Space logging rounds after the athlete uses the toggle', () => {
    // Toggling happens in the rally point, so the focused element afterwards is
    // a checkbox that no longer exists once the clock starts.
    renderAt('waiting');
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    cleanup();

    const { container } = renderAt('work');
    expect(container.querySelector('input')).toBeNull();
    expect(
      shouldHandleLogRoundHotkey({
        key: ' ',
        code: 'Space',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: document.body,
      })
    ).toBe(true);
  });
});

describe('where the gauge appears', () => {
  it('offers the preference in the rally point, before the clock starts', () => {
    renderAt('waiting');
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.queryByRole('figure')).toBeNull();
  });

  it('shows the gauge once the mission is live', () => {
    renderAt('work');
    expect(screen.getByRole('figure')).toBeTruthy();
  });

  it('shows nothing once the mission is over', () => {
    const { container } = renderAt('finished');
    expect(container.innerHTML).toBe('');
  });

  it('stays out of practice entirely', () => {
    const { container } = renderAt('waiting', { isPractice: true });
    expect(container.innerHTML).toBe('');
  });

  it('honours the preference being switched off', () => {
    renderAt('waiting');
    fireEvent.click(screen.getByRole('checkbox'));
    cleanup();

    const { container } = renderAt('work');
    expect(container.innerHTML).toBe('');
  });
});

describe('the gauge failing does not reach the mission', () => {
  it('renders nothing rather than throwing on a missing feed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderAt('work', {
      roundSplitsSec: undefined,
      elapsedSec: Number.NaN,
    });
    // Degrades to the pre-benchmark state instead of unmounting the mission.
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
