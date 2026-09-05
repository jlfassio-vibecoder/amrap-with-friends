import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoachStatGrid } from '@/components/coach/CoachStatGrid';
import { GUEST_BROWSERS_STAT_ID } from '@/lib/coach/guestBrowsersWindows';

describe('CoachStatGrid', () => {
  it('renders a pressed button for the selected selectable guest browsers card', () => {
    const onSelect = vi.fn();
    render(
      <CoachStatGrid
        selectedId={GUEST_BROWSERS_STAT_ID}
        onSelect={onSelect}
        stats={[
          { label: 'Registered users', value: 4 },
          {
            id: GUEST_BROWSERS_STAT_ID,
            selectable: true,
            label: 'Guest browsers (7d)',
            value: 53,
          },
        ]}
      />
    );

    const button = screen.getByRole('button', { name: /Guest browsers \(7d\)/i });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
