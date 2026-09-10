import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkoutSourceToggle } from './WorkoutSourceToggle';

afterEach(() => {
  cleanup();
});

describe('WorkoutSourceToggle', () => {
  it('includes AMQAP and reports amqap', () => {
    const onChange = vi.fn();
    render(<WorkoutSourceToggle value="library" onChange={onChange} />);

    const quality = screen.getByRole('tab', { name: 'AMQAP' });
    expect(quality.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(quality);
    expect(onChange).toHaveBeenCalledWith('amqap');
  });

  it('marks AMQAP selected when the source is amqap', () => {
    render(<WorkoutSourceToggle value="amqap" onChange={() => undefined} />);

    expect(screen.getByRole('tab', { name: 'AMQAP' }).getAttribute('aria-selected')).toBe('true');
  });
});
