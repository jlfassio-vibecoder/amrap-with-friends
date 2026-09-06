import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SmartRecoveryToggle } from './SmartRecoveryToggle';

afterEach(cleanup);

describe('SmartRecoveryToggle', () => {
  it('opens the info modal from the ? button', () => {
    render(<SmartRecoveryToggle enabled={false} onChange={vi.fn()} isAuthenticated />);

    fireEvent.click(screen.getByRole('button', { name: 'How Smart Recovery works' }));

    expect(screen.getByRole('dialog', { name: 'Smart Recovery' })).toBeTruthy();
    expect(screen.getByText(/soft-locks missions that need more recovery/i)).toBeTruthy();
    expect(screen.getByText(/Same workout · 6 days/i)).toBeTruthy();
    expect(screen.getByText(/Hard missions · 72 hours/i)).toBeTruthy();
    expect(screen.getByText(/Same movement pattern · 48 hours/i)).toBeTruthy();
  });

  it('closes the info modal', () => {
    render(<SmartRecoveryToggle enabled={false} onChange={vi.fn()} isAuthenticated />);

    fireEvent.click(screen.getByRole('button', { name: 'How Smart Recovery works' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('dialog', { name: 'Smart Recovery' })).toBeNull();
  });

  it('does not toggle Smart Recovery when opening the info modal', () => {
    const onChange = vi.fn();
    render(<SmartRecoveryToggle enabled={false} onChange={onChange} isAuthenticated />);

    fireEvent.click(screen.getByRole('button', { name: 'How Smart Recovery works' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
