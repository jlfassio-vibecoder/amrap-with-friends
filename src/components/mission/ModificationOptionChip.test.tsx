import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ModificationOptionChip } from '@/components/mission/ModificationOptionChip';

afterEach(cleanup);

const OPTION = {
  id: 'push-up--knees',
  label: 'From the knees',
  how: 'Knees down, hips in line with the shoulders — do not let the hips pike up.',
};

describe('ModificationOptionChip', () => {
  it('exposes the how-line as a hover/focus tooltip', () => {
    render(<ModificationOptionChip option={OPTION} pressed={false} onClick={() => {}} />);

    const chip = screen.getByRole('button', { name: 'From the knees' });
    const tipId = chip.getAttribute('aria-describedby');
    expect(tipId).toBeTruthy();
    const tip = document.getElementById(tipId!);
    expect(tip?.getAttribute('role')).toBe('tooltip');
    expect(tip?.textContent).toBe(OPTION.how);
  });
});
