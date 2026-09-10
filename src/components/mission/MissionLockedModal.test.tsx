import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionLockedModal } from '@/components/mission/MissionLockedModal';

afterEach(cleanup);

const sampleWorkout = [
  { name: 'Air Squats', target: 10, unit: 'reps' },
  { name: 'Hand-Release Push-ups', target: 10, unit: 'reps' },
];

describe('MissionLockedModal', () => {
  it('shows the header, body copy, exercises and command button', () => {
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /mission locked/i })).toBeTruthy();
    expect(
      screen.getByText(
        "Systems are green to go. The squad has left the Rally Point. It's time to MOVE!"
      )
    ).toBeTruthy();
    expect(screen.getByText('Air Squats — 10 reps')).toBeTruthy();
    expect(screen.getByText('Hand-Release Push-ups — 10 reps')).toBeTruthy();
    expect(screen.getByRole('button', { name: /cleared hot/i })).toBeTruthy();
  });

  it('lists exercises above the Cleared hot button', () => {
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={vi.fn()} />);
    const list = screen.getByRole('list');
    const button = screen.getByRole('button', { name: /cleared hot/i });
    expect(Boolean(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    );
  });

  it('omits the list when the workout is empty', () => {
    render(<MissionLockedModal workout={[]} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('calls onDismiss when the command button is tapped', () => {
    const onDismiss = vi.fn();
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /cleared hot/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows the spacebar hint below Cleared hot, hidden until lg', () => {
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={vi.fn()} />);
    const hint = screen.getByText((_, element) => {
      return (
        element?.tagName === 'P' &&
        (element.textContent ?? '').includes('Use spacebar to LOG ROUNDS')
      );
    });
    const button = screen.getByRole('button', { name: /cleared hot/i });
    expect(Boolean(button.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    );
    expect(hint.className).toMatch(/\bhidden\b/);
    expect(hint.className).toMatch(/\blg:block\b/);
  });

  it('calls onDismiss when Escape is pressed', () => {
    const onDismiss = vi.fn();
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('autofocuses the Cleared hot button', () => {
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cleared hot/i })).toBe(document.activeElement);
  });

  it('is a labelled dialog', () => {
    render(<MissionLockedModal workout={sampleWorkout} onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });
});
