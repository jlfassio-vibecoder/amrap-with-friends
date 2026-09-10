import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRoundLogPulse } from '@/hooks/useRoundLogPulse';

afterEach(cleanup);

function TestHost() {
  const { buttonRef, pulseKey, pulse } = useRoundLogPulse();
  return (
    <div>
      <button ref={buttonRef} type="button" onClick={pulse}>
        Log round
      </button>
      <p data-testid="pulse-key">{pulseKey}</p>
    </div>
  );
}

describe('useRoundLogPulse', () => {
  it('starts with no pulse and the button unmarked', () => {
    render(<TestHost />);
    expect(screen.getByTestId('pulse-key').textContent).toBe('0');
    expect(screen.getByRole('button').className).toBe('');
  });

  it('adds the seal class to the button on pulse, without remounting it', () => {
    render(<TestHost />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button.classList.contains('animate-round-log-seal')).toBe(true);
    // Same DOM node, not a fresh one from a `key` remount.
    expect(screen.getByRole('button')).toBe(button);
  });

  it('bumps pulseKey by one on every pulse', () => {
    render(<TestHost />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByTestId('pulse-key').textContent).toBe('1');
    fireEvent.click(button);
    expect(screen.getByTestId('pulse-key').textContent).toBe('2');
  });

  it('replays the seal class across two pulses in a row', () => {
    // A real replay removes then re-adds the class within the same call, so
    // a snapshot mid-pulse can't tell a restarted animation from one that
    // never stopped. What's externally observable is that the class is
    // present again after each pulse and the node is never swapped out.
    render(<TestHost />);
    const button = screen.getByRole('button');
    act(() => {
      fireEvent.click(button);
    });
    act(() => {
      fireEvent.click(button);
    });
    expect(button.classList.contains('animate-round-log-seal')).toBe(true);
    expect(screen.getByRole('button')).toBe(button);
  });

  it('clears pulseKey and the seal class on reset', () => {
    function ResetHost() {
      const { buttonRef, pulseKey, pulse, reset } = useRoundLogPulse();
      return (
        <div>
          <button ref={buttonRef} type="button" onClick={pulse}>
            Log round
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
          <p data-testid="pulse-key">{pulseKey}</p>
        </div>
      );
    }

    render(<ResetHost />);
    const [logButton, resetButton] = screen.getAllByRole('button');
    fireEvent.click(logButton);
    expect(screen.getByTestId('pulse-key').textContent).toBe('1');
    expect(logButton.classList.contains('animate-round-log-seal')).toBe(true);
    fireEvent.click(resetButton);
    expect(screen.getByTestId('pulse-key').textContent).toBe('0');
    expect(logButton.classList.contains('animate-round-log-seal')).toBe(false);
  });
});
