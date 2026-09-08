import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TimeDomainInfoModal } from './TimeDomainInfoModal';

afterEach(() => {
  cleanup();
});

describe('TimeDomainInfoModal', () => {
  it('renders brand, range, axes, and best fit for a domain', () => {
    render(
      <TimeDomainInfoModal domain={10} onClose={() => undefined} onBrowse={() => undefined} />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Crucible/)).toBeTruthy();
    expect(screen.getByText('10 min domain')).toBeTruthy();
    expect(screen.getByText(/Peak cardio/i)).toBeTruthy();
    expect(screen.getByText('Fat burning & calorie burn')).toBeTruthy();
    expect(screen.getByText('Muscle building & toning')).toBeTruthy();
    expect(screen.getByText('Cardio conditioning')).toBeTruthy();
    expect(screen.getByText('How it feels')).toBeTruthy();
    expect(screen.getByText('Best fit')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse 10 min missions' })).toBeTruthy();
  });

  it('browses the domain then closes', () => {
    const onBrowse = vi.fn();
    const onClose = vi.fn();
    render(<TimeDomainInfoModal domain={5} onClose={onClose} onBrowse={onBrowse} />);

    fireEvent.click(screen.getByRole('button', { name: 'Browse 5 min missions' }));
    expect(onBrowse).toHaveBeenCalledWith(5);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<TimeDomainInfoModal domain={20} onClose={onClose} onBrowse={() => undefined} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
