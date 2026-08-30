import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { CampaignTrackPicker } from './CampaignTrackPicker';
import type { CampaignTrack } from '@/lib/campaign';

afterEach(() => cleanup());

describe('CampaignTrackPicker', () => {
  it('marks the first track as Measured on this', () => {
    const onChange = vi.fn();
    const tracks: CampaignTrack[] = [
      { durationMinutes: 10, category: 'blood-shunt' },
      { durationMinutes: 15, category: 'engine-room' },
    ];
    render(<CampaignTrackPicker tracks={tracks} onChange={onChange} />);

    expect(screen.getByText('Measured on this')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Measure on this' })).toBeTruthy();
  });

  it('moves a track to the front when Measure on this is clicked', () => {
    const onChange = vi.fn();
    const tracks: CampaignTrack[] = [
      { durationMinutes: 10, category: 'blood-shunt' },
      { durationMinutes: 15, category: 'engine-room' },
    ];
    render(<CampaignTrackPicker tracks={tracks} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Measure on this' }));
    expect(onChange).toHaveBeenCalledWith([
      { durationMinutes: 15, category: 'engine-room' },
      { durationMinutes: 10, category: 'blood-shunt' },
    ]);
  });

  it('promotes the next track when the measured chip is removed', () => {
    const onChange = vi.fn();
    const tracks: CampaignTrack[] = [
      { durationMinutes: 10, category: 'blood-shunt' },
      { durationMinutes: 15, category: 'engine-room' },
    ];
    render(<CampaignTrackPicker tracks={tracks} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Aerobic Blood Shunt · 10 min' }));
    expect(onChange).toHaveBeenCalledWith([{ durationMinutes: 15, category: 'engine-room' }]);
  });
});
