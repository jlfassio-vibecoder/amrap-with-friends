import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AddToCalendar } from '@/components/calendar/AddToCalendar';

const { downloadIcs } = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock('@/lib/calendar/downloadIcs', () => ({ downloadIcs }));

const event = {
  uid: 'm1',
  title: 'Mission: Blood Shunt · Northside',
  description: 'Join: https://example.com/mission/m1',
  startsAt: new Date('2026-09-15T17:30:00.000Z'),
  durationMinutes: 12,
  location: 'https://example.com/mission/m1',
};

describe('AddToCalendar', () => {
  afterEach(() => {
    cleanup();
    downloadIcs.mockReset();
  });

  it('downloads the file under the name the caller chose', () => {
    render(<AddToCalendar event={event} fileName="northside-mission.ics" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download calendar invite' }));
    expect(downloadIcs).toHaveBeenCalledWith(event, 'northside-mission.ics');
  });

  it('sends Google the same event, pre-filled', () => {
    render(<AddToCalendar event={event} fileName="northside-mission.ics" />);
    const href = screen.getByRole('link', { name: 'Add to Google Calendar' }).getAttribute('href');
    const url = new URL(href ?? '');
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20260915T173000Z/20260915T174200Z');
    expect(url.searchParams.get('text')).toBe('Mission: Blood Shunt · Northside');
  });

  it('reports which of the two the athlete actually used', () => {
    const onSaved = vi.fn();
    render(<AddToCalendar event={event} fileName="x.ics" onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download calendar invite' }));
    expect(onSaved).toHaveBeenCalledWith('ics');

    fireEvent.click(screen.getByRole('link', { name: 'Add to Google Calendar' }));
    expect(onSaved).toHaveBeenCalledWith('google');
  });
});
