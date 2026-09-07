import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionCheckInPanel } from '@/components/mission/MissionCheckInPanel';

afterEach(cleanup);

describe('MissionCheckInPanel', () => {
  it('toggles RPE and a check-in chip', () => {
    const onChange = vi.fn();
    render(
      <MissionCheckInPanel
        value={{ rpe: null, sessionNotes: '', checkIns: {} }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /7\s*Very hard/i }));
    expect(onChange).toHaveBeenCalledWith({
      rpe: 7,
      sessionNotes: '',
      checkIns: {},
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mild' }));
    expect(onChange).toHaveBeenCalledWith({
      rpe: null,
      sessionNotes: '',
      checkIns: { starting_soreness: 'soreness--mild' },
    });
  });

  it('clears a chip when pressed again', () => {
    const onChange = vi.fn();
    render(
      <MissionCheckInPanel
        value={{ rpe: null, sessionNotes: '', checkIns: { pain: 'pain--felt' } }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Felt pain' }));
    expect(onChange).toHaveBeenCalledWith({
      rpe: null,
      sessionNotes: '',
      checkIns: {},
    });
  });
});
