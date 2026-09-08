import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionLockedModal } from '@/components/mission/MissionLockedModal';

afterEach(cleanup);

describe('MissionLockedModal', () => {
  it('shows the header, body copy and command button', () => {
    render(<MissionLockedModal onDismiss={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /mission locked/i })).toBeTruthy();
    expect(
      screen.getByText(
        "Systems are green to go. The squad has left the Rally Point. It's time to MOVE!"
      )
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /cleared hot/i })).toBeTruthy();
  });

  it('calls onDismiss when the command button is tapped', () => {
    const onDismiss = vi.fn();
    render(<MissionLockedModal onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /cleared hot/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('is a labelled dialog', () => {
    render(<MissionLockedModal onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });
});
