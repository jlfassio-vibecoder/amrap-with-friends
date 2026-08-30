import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MissionLoadingModal } from './MissionLoadingModal';

describe('MissionLoadingModal', () => {
  it('shows next-mission copy and confirms', () => {
    const onConfirm = vi.fn();
    render(<MissionLoadingModal onConfirm={onConfirm} />);

    expect(screen.getByRole('dialog', { name: 'Next mission loading' })).toBeDefined();
    expect(screen.getByText(/another mission is on the way/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
