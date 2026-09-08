import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoachWindowPicker } from '@/components/coach/CoachWindowPicker';

describe('CoachWindowPicker', () => {
  afterEach(cleanup);

  it('offers every supported window and reports the chosen one', () => {
    const onChange = vi.fn();
    render(<CoachWindowPicker value="all" onChange={onChange} />);

    const select = screen.getByLabelText('Reporting window');
    expect(screen.getByRole('option', { name: 'Last 7 days' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Last 30 days' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Last 90 days' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'All time' })).toBeTruthy();

    fireEvent.change(select, { target: { value: '30d' } });
    expect(onChange).toHaveBeenCalledWith('30d');
  });

  it('disables while a fetch is in flight', () => {
    render(<CoachWindowPicker value="7d" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText<HTMLSelectElement>('Reporting window').disabled).toBe(true);
  });
});
