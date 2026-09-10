import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TimeCapControl } from './TimeCapControl';

afterEach(cleanup);

describe('TimeCapControl', () => {
  it('stays out of the way at the canonical minute', () => {
    render(<TimeCapControl domain={15} cap={15} onCapChange={vi.fn()} />);

    expect(screen.getByText('15 min')).toBeTruthy();
    // No minute chips until the host asks for them.
    expect(screen.queryByRole('group', { name: 'Time cap' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change it' })).toBeTruthy();
  });

  it('offers only the minutes inside the domain', () => {
    render(<TimeCapControl domain={10} cap={10} onCapChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }));

    const group = screen.getByRole('group', { name: 'Time cap' });
    expect([...group.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      '7 min',
      '8 min',
      '9 min',
      '10 min',
    ]);
  });

  it('reports the chosen minute', () => {
    const onCapChange = vi.fn();
    render(<TimeCapControl domain={20} cap={20} onCapChange={onCapChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }));
    fireEvent.click(screen.getByRole('button', { name: '25 min' }));

    expect(onCapChange).toHaveBeenCalledWith(25);
  });

  it('stays open once the cap is off the canonical minute', () => {
    render(<TimeCapControl domain={5} cap={4} onCapChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Time cap' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change it' })).toBeNull();
  });

  it('says the ghost lane will be empty when the cap leaves the template behind', () => {
    render(
      <TimeCapControl
        domain={10}
        cap={8}
        onCapChange={vi.fn()}
        templateCap={10}
        templateName="Blood Shunt"
      />
    );

    expect(screen.getByText(/Blood Shunt is written for/)).toBeTruthy();
    expect(screen.getByText(/no ghost to race at 8 min/)).toBeTruthy();
  });

  it('says nothing about ghosts while the cap matches the template', () => {
    render(
      <TimeCapControl
        domain={10}
        cap={10}
        onCapChange={vi.fn()}
        templateCap={10}
        templateName="Blood Shunt"
      />
    );

    expect(screen.queryByText(/ghost/)).toBeNull();
  });
});
