import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoachSectionHeader } from './CoachSectionHeader';

describe('CoachSectionHeader', () => {
  it('reloads the page when Refresh is clicked', () => {
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadMock });

    render(<CoachSectionHeader title="Overview" />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Overview' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
